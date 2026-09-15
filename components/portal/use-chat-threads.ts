"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import {
  markProviderChatRead,
  sendProviderChatMessage,
} from "@/lib/api/chat-client";
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
  const apiReady = crm.enabled && crm.ready;
  const liveOnly = Boolean(session) || crm.enabled;
  const threads = useSyncExternalStore(
    subscribeChat,
    () => snapshotFor(email),
    () => EMPTY,
  );
  // Authenticated / CRM sessions never fall back to local demo chat threads.
  const resolvedThreads = apiReady ? crm.chats : liveOnly ? EMPTY : threads;

  const unread = useMemo(
    () => resolvedThreads.reduce((sum, item) => sum + item.unreadForProvider, 0),
    [resolvedThreads],
  );

  const send = useCallback(
    (threadId: string, from: ChatRole, text: string, attachments?: ChatAttachment[]) => {
      if (apiReady) {
        if (from !== "provider") return Promise.resolve();
        return (async () => {
          await sendProviderChatMessage(threadId, text, attachments);
          await crm.refresh();
        })();
      }
      return appendChatMessage({ providerEmail: email, threadId, from, text, attachments });
    },
    [apiReady, crm, email],
  );

  const markRead = useCallback(
    (threadId: string) => {
      if (apiReady) {
        return (async () => {
          await markProviderChatRead(threadId);
          await crm.refresh({ silent: true });
        })();
      }
      markChatRead(email, threadId, "provider");
    },
    [apiReady, crm, email],
  );

  return { email, threads: resolvedThreads, unread, send, markRead };
}
