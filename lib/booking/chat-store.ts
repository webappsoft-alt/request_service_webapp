import { CHAT_EVENT, readJson, writeJson } from "@/lib/booking/demo-stores";
import { getSeedChatThreads } from "@/lib/booking/seed-chats";
import { getAllProviders } from "@/lib/data/providers";

export type ChatRole = "customer" | "provider";

export type ChatAttachment = {
  id: string;
  name: string;
  url: string;
  type: string;
};

export type ChatMessage = {
  id: string;
  from: ChatRole;
  text: string;
  at: string;
  attachments: ChatAttachment[];
};

export type ChatThread = {
  id: string;
  providerId: string;
  customerName: string;
  customerEmail: string;
  requestId?: string;
  unreadForProvider: number;
  unreadForCustomer: number;
  messages: ChatMessage[];
  updatedAt: string;
};

export type ChatGuest = {
  name: string;
  email: string;
};

type ChatStore = {
  threads: ChatThread[];
};

const EMPTY: ChatStore = { threads: [] };
const GUEST_KEY = "rs-chat-guest";

function storeKey(providerEmail: string) {
  return `rs-chat-threads:${providerEmail}`;
}

export function readChatGuest(): ChatGuest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatGuest;
    if (!parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeChatGuest(guest: ChatGuest) {
  window.localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
}

function providerFor(email: string) {
  return getAllProviders().find((item) => item.email.toLowerCase() === email.toLowerCase());
}

function mergeThreads(providerEmail: string, stored: ChatThread[]) {
  const provider = providerFor(providerEmail);
  const seeded = provider ? getSeedChatThreads(provider) : [];
  const storedIds = new Set(stored.map((item) => item.id));
  const storedEmails = new Set(stored.map((item) => item.customerEmail.toLowerCase()));
  const extras = seeded.filter(
    (item) => !storedIds.has(item.id) && !storedEmails.has(item.customerEmail.toLowerCase()),
  );
  return [...extras, ...stored];
}

function readStore(providerEmail: string): ChatStore {
  if (typeof window === "undefined") return EMPTY;
  const parsed = readJson<ChatStore>(storeKey(providerEmail), EMPTY);
  return { threads: mergeThreads(providerEmail, parsed.threads ?? []) };
}

function writeStore(providerEmail: string, store: ChatStore) {
  writeJson(storeKey(providerEmail), store, CHAT_EVENT);
}

export function listChatThreads(providerEmail: string) {
  return [...readStore(providerEmail).threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findChatThread(
  providerEmail: string,
  match: { id?: string; requestId?: string; customerEmail?: string },
) {
  const threads = readStore(providerEmail).threads;
  if (match.id) return threads.find((item) => item.id === match.id);
  if (match.requestId) return threads.find((item) => item.requestId === match.requestId);
  if (match.customerEmail) {
    const email = match.customerEmail.toLowerCase();
    return threads.find((item) => item.customerEmail.toLowerCase() === email);
  }
  return undefined;
}

export function unreadChatCount(providerEmail: string) {
  return listChatThreads(providerEmail).reduce((sum, item) => sum + item.unreadForProvider, 0);
}

export function ensureChatThread(input: {
  providerEmail: string;
  providerId: string;
  customerName: string;
  customerEmail: string;
  requestId?: string;
}) {
  const existing =
    findChatThread(input.providerEmail, { requestId: input.requestId }) ??
    findChatThread(input.providerEmail, { customerEmail: input.customerEmail });
  if (existing) {
    if (input.requestId && !existing.requestId) {
      const store = readStore(input.providerEmail);
      writeStore(input.providerEmail, {
        threads: store.threads.map((item) =>
          item.id === existing.id ? { ...item, requestId: input.requestId, customerName: input.customerName } : item,
        ),
      });
      return { ...existing, requestId: input.requestId, customerName: input.customerName };
    }
    return existing;
  }

  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: `chat_${Date.now().toString(36)}`,
    providerId: input.providerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail.trim(),
    requestId: input.requestId,
    unreadForProvider: 0,
    unreadForCustomer: 0,
    messages: [],
    updatedAt: now,
  };
  const store = readStore(input.providerEmail);
  writeStore(input.providerEmail, { threads: [...store.threads, thread] });
  return thread;
}

export function appendChatMessage(input: {
  providerEmail: string;
  threadId: string;
  from: ChatRole;
  text: string;
  attachments?: ChatAttachment[];
}) {
  const store = readStore(input.providerEmail);
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    from: input.from,
    text: input.text.trim(),
    at: now,
    attachments: input.attachments ?? [],
  };
  const threads = store.threads.map((thread) => {
    if (thread.id !== input.threadId) return thread;
    return {
      ...thread,
      messages: [...thread.messages, message],
      updatedAt: now,
      unreadForProvider: input.from === "customer" ? thread.unreadForProvider + 1 : thread.unreadForProvider,
      unreadForCustomer: input.from === "provider" ? thread.unreadForCustomer + 1 : thread.unreadForCustomer,
    };
  });
  writeStore(input.providerEmail, { threads });
  return message;
}

export function markChatRead(providerEmail: string, threadId: string, reader: ChatRole) {
  const store = readStore(providerEmail);
  writeStore(providerEmail, {
    threads: store.threads.map((thread) => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        unreadForProvider: reader === "provider" ? 0 : thread.unreadForProvider,
        unreadForCustomer: reader === "customer" ? 0 : thread.unreadForCustomer,
      };
    }),
  });
}

export function subscribeChat(onStoreChange: () => void) {
  window.addEventListener(CHAT_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHAT_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
