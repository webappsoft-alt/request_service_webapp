"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
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
  const email = session?.email || provider.email;
  const threads = useSyncExternalStore(
    subscribeChat,
    () => snapshotFor(email),
    () => EMPTY,
  );

  const unread = useMemo(
    () => threads.reduce((sum, item) => sum + item.unreadForProvider, 0),
    [threads],
  );

  const send = useCallback(
    (threadId: string, from: ChatRole, text: string, attachments?: ChatAttachment[]) => {
      return appendChatMessage({ providerEmail: email, threadId, from, text, attachments });
    },
    [email],
  );

  const markRead = useCallback(
    (threadId: string) => {
      markChatRead(email, threadId, "provider");
    },
    [email],
  );

  return { email, threads, unread, send, markRead };
}
