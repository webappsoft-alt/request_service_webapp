"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Phone,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Container, Section } from "@/components/layout/container";
import { ChatPanel } from "@/components/shared/chat-panel";
import {  useRealtime } from "@/components/realtime/realtime-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatWorkspaceSkeleton, MessageThreadSkeleton } from "@/components/shared/loading-skeletons";
import { CenteredSpinner } from "@/components/ui/spinner";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { customerPaths } from "@/lib/customer-paths";
import { getAllProviders } from "@/lib/data/providers";
import {
  listPublicChatThreads,
  fetchPublicChatThread,
  markPublicChatRead,
  sendPublicChatMessage,
  sendAdminDirectChatMessage,
  markAdminDirectChatReadForPeer,
  ADMIN_DIRECT_THREAD_ID,
} from "@/lib/api/chat-client";
import { mapAdminDirectChat } from "@/lib/api/crm-mappers";
import {
  readChatGuest,
  type ChatAttachment,
  type ChatThread,
} from "@/lib/booking/chat-store";
import {
  formatThreadTime,
  getAvatarColor,
  getInitials,
} from "@/lib/chat-format";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread";

type ProviderLookup = {
  name: string;
  avatar?: string;
  phone?: string;
  slug?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function fetchProviderLookup(providerId: string): Promise<ProviderLookup | null> {
  const id = String(providerId || "").trim();
  if (!id) return null;
  try {
    const response = await getData(publicApi.professional(id), undefined, {
      silent: true,
      force: true,
      token: null,
      skipLogoutOn401: true,
    });
    const root = asRecord(response) || {};
    const data = asRecord(root.data) || root;
    const name = String(
      data.companyName || data.businessName || data.name || data.fullName || "",
    ).trim();
    if (!name) return null;
    return {
      name,
      avatar:
        String(data.logo || data.avatarUrl || data.avatar || "").trim() || undefined,
      phone: String(data.phone || "").trim() || undefined,
      slug: String(data.slug || "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function enrichThreadsWithProviderNames(threads: ChatThread[]): Promise<ChatThread[]> {
  const missingIds = [
    ...new Set(
      threads
        .filter(
          (thread) =>
            !String(thread.providerName || "").trim() &&
            thread.providerId &&
            thread.id !== ADMIN_DIRECT_THREAD_ID &&
            /^[0-9a-fA-F]{24}$/.test(thread.providerId),
        )
        .map((thread) => thread.providerId),
    ),
  ];
  if (!missingIds.length) return threads;

  const entries = await Promise.all(
    missingIds.map(async (id) => [id, await fetchProviderLookup(id)] as const),
  );
  const byId = Object.fromEntries(
    entries.filter((entry): entry is [string, ProviderLookup] => Boolean(entry[1])),
  );

  return threads.map((thread) => {
    const lookup = byId[thread.providerId];
    if (!lookup) return thread;
    return {
      ...thread,
      providerName: thread.providerName || lookup.name,
      providerAvatar: thread.providerAvatar || lookup.avatar,
      providerPhone: thread.providerPhone || lookup.phone,
      providerSlug: thread.providerSlug || lookup.slug,
    };
  });
}

function resolveThreadProvider(thread: ChatThread) {
  const apiName = String(thread.providerName || "").trim();
  if (apiName && !/^provider$/i.test(apiName) && !/^service professional$/i.test(apiName)) {
    return {
      name: apiName,
      avatar: thread.providerAvatar,
      phone: thread.providerPhone,
      slug: thread.providerSlug,
    };
  }
  const matched = getAllProviders().find(
    (p) =>
      p.id === thread.providerId ||
      p.email?.toLowerCase() === thread.providerId?.toLowerCase() ||
      p.slug === thread.providerId ||
      p.slug === thread.providerSlug,
  );
  if (matched) {
    return {
      name: matched.companyName,
      avatar: matched.images?.[0] || thread.providerAvatar,
      phone: matched.phone || thread.providerPhone,
      slug: matched.slug || thread.providerSlug,
    };
  }
  const slugLabel = String(thread.providerSlug || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    name: slugLabel || "Pro",
    avatar: thread.providerAvatar,
    phone: thread.providerPhone,
    slug: thread.providerSlug,
  };
}

function upsertThread(threads: ChatThread[], updated: ChatThread) {
  const existing = threads.find((t) => t.id === updated.id);
  if (!existing) {
    return [...threads, updated].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const existingMsgIds = new Set(
    existing.messages.map((m) => m.id || (m as any)._id).filter(Boolean),
  );
  const newFromServer = (updated.messages || []).filter(
    (m) => !existingMsgIds.has(m.id || (m as any)._id),
  );
  const merged: ChatThread = {
    ...existing,
    ...updated,
    providerName: updated.providerName || existing.providerName,
    providerAvatar: updated.providerAvatar || existing.providerAvatar,
    providerPhone: updated.providerPhone || existing.providerPhone,
    providerSlug: updated.providerSlug || existing.providerSlug,
    messages: [...existing.messages, ...newFromServer],
  };
  return [...threads.filter((item) => item.id !== updated.id), merged].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

function resolveListingEmail(
  authEmail: string | undefined,
  guestEmail: string | undefined,
) {
  const fromAuth = String(authEmail || "").trim();
  if (fromAuth) return fromAuth;
  return String(guestEmail || "").trim();
}

export function CustomerMessagesView({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const directAdmin = searchParams.get("direct") === "admin";
  const selectedId = directAdmin
    ? ADMIN_DIRECT_THREAD_ID
    : (searchParams.get("thread") ?? "");
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const {
    joinThread,
    leaveThread,
    setTyping,
    connected,
    getPresence,
    queryUserPresence,
    markThreadRead,
    supportOnline,
  } = useRealtime();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listHasMore, setListHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  // Tracks the thread currently shown in the panel (incl. auto-select without URL)
  const viewingThreadIdRef = useRef<string | null>(null);

  const listingEmail = useMemo(
    () => resolveListingEmail(user?.email, guestEmail),
    [guestEmail, user?.email],
  );

  useEffect(() => {
    setGuestEmail(readChatGuest()?.email ?? "");
  }, []);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.messages)}`,
      );
    }
  }, [auth.hydrated, isAuthenticated, router]);

  const loadThreads = useCallback(
    async (options?: { silent?: boolean; page?: number; append?: boolean }) => {
      if (!listingEmail) {
        setThreads([]);
        setLoading(false);
        setError(null);
        return;
      }
      const page = options?.page ?? 1;
      if (!options?.silent && !options?.append) setLoading(true);
      if (options?.append) setLoadingMore(true);
      try {
        // List API now includes Platform Support on page 1 by default
        const result = await listPublicChatThreads(listingEmail, {
          silent: options?.silent ?? true,
          page,
          limit: 10,
        });
        const enriched = await enrichThreadsWithProviderNames(result.items);
        setThreads((prev) => {
          if (options?.append) {
            const seen = new Set(prev.map((t) => t.id));
            return [...prev, ...enriched.filter((t) => !seen.has(t.id))];
          }
          return enriched;
        });
        setListPage(page);
        const pages = result.pagination?.pages || 1;
        setListHasMore(page < pages);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load messages.";
        setError(message);
        if (!options?.silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [listingEmail],
  );

  useEffect(() => {
    if (!auth.hydrated || !isAuthenticated) return;
    void loadThreads();
  }, [auth.hydrated, isAuthenticated, loadThreads]);

  useEffect(() => {
    if (!listingEmail) return;

    // Use subscribeRealtime (window event bus) instead of onRealtime (raw socket).
    // The raw socket's onRealtime() silently drops handlers if the socket isn't
    // connected yet at call time. The RealtimeProvider always re-dispatches every
    // socket event to the window bus, so subscribeRealtime works regardless of
    // connection timing or reconnects.
    const unsub = subscribeRealtime((detail) => {
      if (!detail?.type || !detail.payload) return;

      if (detail.type === "CHAT_THREAD_UPDATED") {
        const updated = detail.payload as ChatThread;
        if (!updated?.id) return;
        if (
          String(updated.customerEmail || "").toLowerCase() !==
          listingEmail.toLowerCase()
        ) {
          return;
        }
        void (async () => {
          const [enriched] = await enrichThreadsWithProviderNames([updated]);
          setThreads((current) => upsertThread(current, enriched || updated));
        })();
        return;
      }

      if (detail.type === "CHAT_MESSAGE") {
        const payload = detail.payload as { threadId?: string; message?: any; thread?: any };
        if (!payload?.threadId || !payload?.message) return;
        setThreads((current) => {
          const index = current.findIndex((t) => t.id === payload.threadId);
          if (index >= 0) {
            const thread = current[index];
            const msgId = payload.message.id || payload.message._id;
            if (msgId && thread.messages.some((m) => (m.id || (m as any)._id) === msgId)) {
              return current;
            }
            const isViewing = viewingThreadIdRef.current === thread.id;
            const normalizedMsg = {
              ...payload.message,
              id: msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              at: payload.message.at || payload.message.createdAt || new Date().toISOString(),
            };
            const updated: ChatThread = {
              ...thread,
              messages: [...thread.messages, normalizedMsg as any],
              updatedAt: normalizedMsg.at,
              unreadForCustomer:
                payload.message.from === "provider" && !isViewing
                  ? (thread.unreadForCustomer || 0) + 1
                  : thread.unreadForCustomer,
            };
            const next = [...current];
            next.splice(index, 1);
            return [updated, ...next];
          }
          if (payload.thread) {
            return upsertThread(current, payload.thread as any);
          }
          void loadThreads({ silent: true });
          return current;
        });
        return;
      }

      if (detail.type === "CHAT_READ_RECEIPT") {
        const payload = detail.payload as {
          threadId?: string;
          readBy?: string;
          unreadForProvider?: number;
          unreadForCustomer?: number;
        };
        if (!payload?.threadId) return;
        const { threadId, readBy, unreadForProvider, unreadForCustomer } = payload;
        setThreads((current) =>
          current.map((t) => {
            if (t.id !== threadId) return t;
            return {
              ...t,
              unreadForCustomer:
                readBy === "customer" ? (unreadForCustomer ?? 0) : t.unreadForCustomer,
              unreadForProvider:
                readBy === "provider" ? (unreadForProvider ?? 0) : t.unreadForProvider,
              messages: t.messages.map((m) =>
                m.from !== readBy ? { ...m, isRead: true, status: "read" as const } : m
              ),
            };
          }),
        );
        return;
      }

      if (detail.type === "DIRECT_CHAT_MESSAGE") {
        const payload = detail.payload as { chat?: unknown; message?: { from?: string } };
        const mapped = payload?.chat
          ? mapAdminDirectChat(payload.chat, "customer")
          : null;
        if (mapped) {
          setThreads((current) => {
            const without = current.filter((t) => t.id !== ADMIN_DIRECT_THREAD_ID);
            const isViewing = viewingThreadIdRef.current === ADMIN_DIRECT_THREAD_ID;
            return [
              {
                ...mapped,
                unreadForCustomer: isViewing ? 0 : mapped.unreadForCustomer,
                unreadForAdmin: mapped.unreadForAdmin,
              },
              ...without,
            ];
          });
          if (viewingThreadIdRef.current === ADMIN_DIRECT_THREAD_ID) {
            void markAdminDirectChatReadForPeer("customer").catch(() => undefined);
          }
        } else {
          void loadThreads({ silent: true });
        }
        return;
      }

      if (detail.type === "DIRECT_CHAT_READ") {
        const payload = detail.payload as {
          readBy?: string;
          unreadForAdmin?: number;
          unreadForPeer?: number;
        };
        setThreads((current) =>
          current.map((t) => {
            if (t.id !== ADMIN_DIRECT_THREAD_ID) return t;
            const readBy = payload?.readBy;
            const next = { ...t };
            if (readBy === "admin") {
              next.unreadForAdmin = payload.unreadForAdmin ?? 0;
              next.messages = t.messages.map((m) =>
                m.from === "customer"
                  ? { ...m, isRead: true, status: "read" as const }
                  : m,
              );
            } else if (readBy === "customer" || readBy === "provider") {
              next.unreadForCustomer = payload.unreadForPeer ?? 0;
              next.messages = t.messages.map((m) =>
                m.from === "admin"
                  ? { ...m, isRead: true, status: "read" as const }
                  : m,
              );
            } else {
              next.unreadForCustomer = 0;
            }
            return next;
          }),
        );
        return;
      }
    });

    return () => {
      unsub();
    };
  }, [listingEmail, loadThreads, selectedId]);

  const filteredThreads = useMemo(() => {
    let result = threads;

    if (filterTab === "unread") {
      result = result.filter((item) => (item.unreadForCustomer || 0) > 0);
    }

    const needle = query.trim().toLowerCase();
    if (!needle) return result;

    return result.filter((thread) => {
      const provider = resolveThreadProvider(thread);
      const last = thread.messages.at(-1);
      const haystack = [
        provider.name,
        thread.providerId,
        thread.requestId,
        last?.text,
        ...thread.messages.map((message) => message.text),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [filterTab, query, threads]);

  const selected = useMemo(() => {
    if (selectedId) {
      return (
        filteredThreads.find((item) => item.id === selectedId) ??
        threads.find((item) => item.id === selectedId) ??
        null
      );
    }
    return filteredThreads[0] ?? threads[0] ?? null;
  }, [filteredThreads, selectedId, threads]);

  viewingThreadIdRef.current = selected?.id ?? null;

  // When a specific chat is active (URL), fetch full thread by id only (auth token)
  useEffect(() => {
    if (!selectedId || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchPublicChatThread(selectedId, {
          silent: true,
          limit: 50,
        });
        if (cancelled || !detail) return;
        const [enriched] = await enrichThreadsWithProviderNames([detail]);
        setThreads((current) => upsertThread(current, enriched || detail));
      } catch {
        // Keep list preview if detail fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, isAuthenticated]);

  useEffect(() => {
    if (selectedId) {
      setMobileChatOpen(true);
    }
  }, [selectedId]);

  // Track which thread we've already marked as read
  const lastMarkedReadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selected?.id || !listingEmail) return;
    const lastMsg = selected.messages.at(-1);
    const hasUnread =
      selected.id === ADMIN_DIRECT_THREAD_ID
        ? (selected.unreadForCustomer ?? 0) > 0
        : (selected.unreadForCustomer ?? 0) > 0;
    const isNewIncoming =
      lastMsg &&
      lastMsg.from !== "customer" &&
      !lastMsg.isRead;

    // Only mark when there is something unread — never on mere first-select
    if (!(hasUnread || isNewIncoming)) return;
    if (lastMarkedReadRef.current === `${selected.id}:${selected.messages.length}`) {
      return;
    }
    lastMarkedReadRef.current = `${selected.id}:${selected.messages.length}`;

    if (selected.id === ADMIN_DIRECT_THREAD_ID) {
      void markAdminDirectChatReadForPeer("customer").catch(() => undefined);
      setThreads((current) =>
        current.map((t) =>
          t.id === ADMIN_DIRECT_THREAD_ID ? { ...t, unreadForCustomer: 0 } : t,
        ),
      );
      return;
    }
    markThreadRead(selected.id);
    void markPublicChatRead(selected.id, listingEmail).catch(() => undefined);
    setThreads((current) =>
      current.map((t) => (t.id === selected.id ? { ...t, unreadForCustomer: 0 } : t)),
    );
  }, [listingEmail, selected?.id, selected?.messages?.length, selected?.unreadForCustomer, markThreadRead]);

  // Query presence by User ids (providerUserId), not Provider document ids
  const presenceIdsKey = useMemo(() => {
    const ids = Array.from(
      new Set(
        threads
          .map((t) => t.providerUserId)
          .filter((id): id is string => Boolean(id && /^[0-9a-fA-F]{24}$/.test(id))),
      ),
    ).sort();
    return ids.join(",");
  }, [threads]);

  useEffect(() => {
    if (!presenceIdsKey) return;
    queryUserPresence(presenceIdsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceIdsKey]);

  function isCounterpartOnline(thread: ChatThread | null | undefined): boolean {
    if (!thread) return false;
    if (thread.id === ADMIN_DIRECT_THREAD_ID) {
      return Boolean(supportOnline || thread.isOnline);
    }
    if (thread.providerUserId) {
      const live = getPresence(thread.providerUserId)?.isOnline;
      if (typeof live === "boolean") return live;
    }
    return Boolean(
      thread.presence?.provider?.isOnline ?? thread.isOnline ?? false,
    );
  }

  // Real-time typing listener for active customer thread
  useEffect(() => {
    setIsOtherTyping(false);
    if (!selected?.id) return;

    let timer: ReturnType<typeof setTimeout>;
    const unsub = subscribeRealtime((detail) => {
      if (detail?.type === "CHAT_TYPING" && detail.payload) {
        const payload = detail.payload as {
          threadId?: string;
          from?: string;
          isTyping?: boolean | number | string;
        };
        if (payload.threadId === selected.id && payload.from !== "customer") {
          const typingOn =
            payload.isTyping === false ||
            payload.isTyping === 0 ||
            payload.isTyping === "false"
              ? false
              : Boolean(payload.isTyping ?? true);
          setIsOtherTyping(typingOn);
          clearTimeout(timer);
          if (typingOn) {
            timer = setTimeout(() => setIsOtherTyping(false), 3500);
          }
        }
      }
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id) return;
    // Join room for both C↔P threads and Platform Support so backend can
    // skip notifications while this chat is active.
    joinThread(selected.id);
    return () => leaveThread(selected.id);
  }, [joinThread, leaveThread, selected?.id]);

  async function handleSend(text: string, attachments: ChatAttachment[]) {
    if (!selected?.id || !listingEmail) {
      toast.error("Unable to send the message.");
      return;
    }
    try {
      if (selected.id === ADMIN_DIRECT_THREAD_ID) {
        const updated = await sendAdminDirectChatMessage(
          "customer",
          text,
          attachments,
        );
        if (!updated) throw new Error("Unable to send the message.");
        setThreads((current) => {
          const without = current.filter((t) => t.id !== ADMIN_DIRECT_THREAD_ID);
          return [updated, ...without];
        });
        return;
      }
      const updated = await sendPublicChatMessage(
        selected.id,
        listingEmail,
        text,
        attachments,
      );
      if (!updated) throw new Error("Unable to send the message.");
      setThreads((current) => upsertThread(current, updated));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to send the message.",
      );
    }
  }

  if (!auth.hydrated || !isAuthenticated) {
    if (embedded) {
      return <CenteredSpinner label="Loading messages" className="min-h-64" />;
    }
    return (
      <Section tone="muted">
        <Container>
          <CenteredSpinner label="Loading messages" className="min-h-64" />
        </Container>
      </Section>
    );
  }

  const showInitialLoading = loading && !threads.length && !error;
  const unreadCount = threads.filter((item) => (item.unreadForCustomer || 0) > 0).length;
  const selectedProvider = selected ? resolveThreadProvider(selected) : null;

  const content = (
    <div
      className={cn(
        "flex flex-1 flex-col overflow-hidden bg-background",
        embedded
          ? "-m-3 sm:-m-4 h-[calc(100vh-48px)] min-h-[580px]"
          : "h-[calc(100vh-120px)] min-h-[600px] rounded-xl border border-input",
      )}
    >
      {showInitialLoading ? (
        <ChatWorkspaceSkeleton />
      ) : error && !threads.length ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="text-base font-medium text-foreground">
            Couldn’t load your messages
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error}
          </p>
          <Button type="button" className="mt-4" onClick={() => void loadThreads()}>
            Try again
          </Button>
        </div>
      ) : !threads.length ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#003F7D]/10 text-[#003F7D]">
            <MessageSquare className="size-8" />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              No messages yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When you message a professional from their profile or submit a quote request, conversations will show up here.
            </p>
          </div>
          <Button asChild className="bg-[#003F7D] text-white hover:bg-[#003264]">
            <Link href="/find-a-professional">Find a professional</Link>
          </Button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
          {/* Left Sidebar: Threads Inbox */}
          <aside
            className={cn(
              "flex h-full w-full flex-col border-r border-input bg-card transition-all md:w-80 lg:w-[23rem]",
              mobileChatOpen && selected ? "hidden md:flex" : "flex",
            )}
          >
            {/* Sidebar Header */}
            <div className="flex flex-col gap-2.5 border-b border-input p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-foreground">
                    Messages
                  </h1>
                  <span className="inline-flex h-5 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                    {threads.length}
                  </span>
                </div>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {unreadCount} new
                  </span>
                ) : null}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search professionals, chats…"
                  aria-label="Search conversations"
                  className="h-8.5 rounded-lg bg-background pl-8 pr-7 text-xs"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filterTab === "all"
                      ? "bg-[#003F7D] text-white shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  All ({threads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("unread")}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filterTab === "unread"
                      ? "bg-[#003F7D] text-white shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                </button>
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-input">
              {filteredThreads.length ? (
                filteredThreads.map((thread) => {
                  const active = selected?.id === thread.id;
                  const prov = resolveThreadProvider(thread);
                  const last = thread.messages.at(-1);
                  const lastTime = formatThreadTime(last?.at || thread.updatedAt);
                  const hasUnread = (thread.unreadForCustomer || 0) > 0;
                  const isProvOnline = isCounterpartOnline(thread);

                  return (
                    <Link
                      key={thread.id}
                      href={
                        thread.id === ADMIN_DIRECT_THREAD_ID
                          ? `${customerPaths.messages}?direct=admin`
                          : `${customerPaths.messages}?thread=${thread.id}`
                      }
                      onClick={() => setMobileChatOpen(true)}
                      className={cn(
                        "group relative flex items-start gap-3 p-3 transition-colors text-left",
                        active
                          ? "bg-[#003F7D]/8 border-l-4 border-l-[#003F7D]"
                          : "hover:bg-muted/50",
                      )}
                    >
                      {/* Provider Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="size-10 shadow-2xs ring-1 ring-input">
                          {prov.avatar ? (
                            <AvatarImage src={prov.avatar} alt={prov.name} />
                          ) : null}
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              getAvatarColor(prov.name),
                            )}
                          >
                            {getInitials(prov.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isProvOnline ? (
                          <span
                            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                            aria-label="Online"
                          />
                        ) : null}
                      </div>

                      {/* Content Preview */}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "truncate text-sm",
                              hasUnread ? "font-bold text-foreground" : "font-medium text-foreground",
                            )}
                          >
                            {prov.name}
                          </span>
                          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                            {lastTime}
                          </span>
                        </div>

                        {/* Middle row: lead/quote meta under provider name — never replace the name */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex min-w-0 items-center gap-1.5 truncate">
                            {thread.requestMeta?.number ||
                            thread.requestMeta?.serviceName ||
                            thread.requestId ? (
                              <span className="inline-flex max-w-full items-center truncate rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-medium text-[#003F7D] dark:bg-blue-950/60 dark:text-blue-300">
                                {[
                                  thread.requestMeta?.number,
                                  thread.requestMeta?.serviceName ||
                                    (thread.requestId ? "Quote request" : null),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            ) : null}
                          </div>
                          {hasUnread ? (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#003F7D] text-[10px] font-bold text-white shadow-xs">
                              {thread.unreadForCustomer}
                            </span>
                          ) : null}
                        </div>

                        {/* Last Message Snippet */}
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {last ? (
                            <>
                              {last.from === "customer" ? (
                                <span className="font-semibold text-foreground/75">
                                  You:{" "}
                                </span>
                              ) : null}
                              {last.text ? (
                                <span>{last.text}</span>
                              ) : last.attachments.some((a) =>
                                  a.type.startsWith("image/"),
                                ) ? (
                                <span className="inline-flex items-center gap-1">
                                  <Camera className="size-3 text-muted-foreground" />
                                  Photo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="size-3 text-muted-foreground" />
                                  Attachment
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="italic opacity-70">No messages yet</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <MessageSquare className="size-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">No conversations found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {query
                      ? "No chats matched your search query."
                      : "No unread messages."}
                  </p>
                  {query ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => setQuery("")}
                    >
                      Clear search
                    </Button>
                  ) : null}
                </div>
              )}
              {listHasMore && !query ? (
                <div className="p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={loadingMore}
                    onClick={() =>
                      void loadThreads({
                        silent: true,
                        page: listPage + 1,
                        append: true,
                      })
                    }
                  >
                    {loadingMore ? "Loading…" : "Load more chats"}
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>

          {/* Right Main Area: Active Chat */}
          <main
            className={cn(
              "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background",
              !mobileChatOpen && selected ? "hidden md:flex" : "flex",
            )}
          >
            {selected && selectedProvider ? (
              <div className="flex h-full min-h-0 flex-1 flex-col">
                {/* Chat Top Header */}
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-input bg-card px-4 sm:px-6 shadow-2xs">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setMobileChatOpen(false)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                      aria-label="Back to conversations list"
                    >
                      <ArrowLeft className="size-5" />
                    </button>

                    {/* Provider Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className="size-10 shadow-2xs ring-1 ring-input">
                        {selectedProvider.avatar ? (
                          <AvatarImage
                            src={selectedProvider.avatar}
                            alt={selectedProvider.name}
                          />
                        ) : null}
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            getAvatarColor(selectedProvider.name),
                          )}
                        >
                          {getInitials(selectedProvider.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
                          isCounterpartOnline(selected)
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/30",
                        )}
                        aria-label={
                          isCounterpartOnline(selected) ? "Online" : "Offline"
                        }
                      />
                    </div>

                    {/* Contact Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {selectedProvider.name}
                        </h2>
                        {isCounterpartOnline(selected) ? (
                          <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {selected.requestMeta?.number ||
                        selected.requestMeta?.serviceName ||
                        selected.requestId ? (
                          <span className="truncate">
                            {[
                              selected.requestMeta?.number,
                              selected.requestMeta?.serviceName || "Quote request",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : (
                          <span>Messages</span>
                        )}
                        {selectedProvider.phone ? (
                          <a
                            href={`tel:${selectedProvider.phone}`}
                            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                          >
                            <Phone className="size-3 shrink-0" />
                            <span>{selectedProvider.phone}</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {selectedProvider.slug ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-medium"
                        asChild
                      >
                        <Link href={`/professionals/${selectedProvider.slug}`}>
                          <ExternalLink className="size-3.5" />
                          <span className="hidden sm:inline">View</span> Profile
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs font-medium"
                      asChild
                    >
                      <Link href={customerPaths.estimates}>Estimates</Link>
                    </Button>
                  </div>
                </header>

                {/* Chat Panel with Messages */}
                <ChatPanel
                  messages={selected.messages}
                  self="customer"
                  recipientUnreadCount={
                    selected.id === ADMIN_DIRECT_THREAD_ID
                      ? (selected.unreadForAdmin ?? 0)
                      : selected.unreadForProvider
                  }
                  otherName={selectedProvider.name}
                  otherAvatar={selectedProvider.avatar}
                  isOtherTyping={isOtherTyping}
                  otherTypingName={selectedProvider.name}
                  onSend={handleSend}
                  onTypingChange={(isTyping) =>
                    setTyping(selected.id, isTyping)
                  }
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquare className="size-7 text-muted-foreground/60" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Select a conversation
                </h2>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Choose a chat from the left sidebar to send messages, ask project questions, and review quotes.
                </p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <Section tone="muted">
      <Container className="max-w-7xl">{content}</Container>
    </Section>
  );
}
