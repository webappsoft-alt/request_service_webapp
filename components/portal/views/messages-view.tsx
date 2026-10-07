"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  FilePlus2,
  FileText,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  RotateCw,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { ChatPanel } from "@/components/shared/chat-panel";
import { useChatThreads, providerActiveThreadIdRef } from "@/components/portal/use-chat-threads";
import { subscribeRealtime, useRealtime } from "@/components/realtime/realtime-provider";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatWorkspaceSkeleton } from "@/components/shared/loading-skeletons";
import {
  formatClockTime,
  formatThreadTime,
  getAvatarColor,
  getInitials,
  sortChatThreadsByUnreadThenRecent,
} from "@/lib/chat-format";
import { cn } from "@/lib/utils";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { TechChatInbox } from "@/components/tech-chat/tech-chat-inbox";
import { useTechChatUnread } from "@/components/tech-chat/use-tech-chat-unread";
import { useFillViewport } from "@/components/portal/use-fill-viewport";
import { ADMIN_DIRECT_THREAD_ID } from "@/lib/api/crm-mappers";

type FilterTab = "all" | "unread" | "leads";

/**
 * Provider Messages: customer / lead chats and technician chats in one place.
 * `?tab=technicians` switches to the technician ↔ office conversations.
 */
export function MessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const technicians = searchParams.get("tab") === "technicians";
  const customerUnread = usePortalInbox().unreadChats;
  const technicianUnread = useTechChatUnread("provider");
  // Size the chat workspace to the real space left under the portal header.
  const frameRef = useRef<HTMLDivElement>(null);
  const frameHeight = useFillViewport(frameRef, { min: 520 });
  const tabs = [
    { id: "customers", label: "Customers & leads", unread: customerUnread, active: !technicians },
    { id: "technicians", label: "Technicians", unread: technicianUnread, active: technicians },
  ];

  return (
    <div
      ref={frameRef}
      style={frameHeight ? { height: frameHeight } : undefined}
      className="-m-3 sm:-m-4 flex h-[calc(100vh-93px)] min-h-[520px] flex-col overflow-hidden bg-background"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2 sm:px-4" role="tablist" aria-label="Conversations">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.active}
            onClick={() =>
              router.replace(tab.id === "technicians" ? "/pro/dashboard/messages?tab=technicians" : "/pro/dashboard/messages", {
                scroll: false,
              })
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              tab.active ? "bg-[#003F7D] text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.unread > 0 ? (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none",
                  tab.active ? "bg-white text-[#003F7D]" : "bg-[#c2410c] text-white",
                )}
              >
                {tab.unread > 99 ? "99+" : tab.unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {technicians ? (
        // Pinned to the space under the tabs so both panes always reach the bottom.
        <div className="relative min-h-0 flex-1">
          <TechChatInbox
            side="provider"
            initialThreadId={searchParams.get("thread")}
            className="absolute inset-0 h-full min-h-0 rounded-none border-0"
            onSelect={(id) =>
              router.replace(
                id ? `/pro/dashboard/messages?tab=technicians&thread=${id}` : "/pro/dashboard/messages?tab=technicians",
                { scroll: false },
              )
            }
          />
        </div>
      ) : (
        <CustomerMessages />
      )}
    </div>
  );
}

function CustomerMessages() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const directAdmin = searchParams.get("direct") === "admin";
  const selectedId = directAdmin
    ? "admin-direct"
    : (searchParams.get("thread") ?? "");
  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const viewingThreadIdRef = useRef<string | null>(null);

  const { threads, send, markRead, loading, refresh } = useChatThreads();
  const {
    joinThread,
    leaveThread,
    setTyping,
    connected,
    markThreadRead,
    getPresence,
    queryUserPresence,
    supportOnline,
  } = useRealtime();

  const lastMarkedThreadIdRef = useRef<string | null>(null);

  // Actively fetch live chat threads once on mount
  useEffect(() => {
    void refresh({ force: true, silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter threads by search query and active tab; unread + recent first
  const filtered = useMemo(() => {
    let result = threads;

    if (filterTab === "unread") {
      result = result.filter((item) => item.unreadForProvider > 0);
    } else if (filterTab === "leads") {
      result = result.filter((item) => Boolean(item.requestId));
    }

    const needle = query.trim().toLowerCase();
    if (needle) {
      result = result.filter((thread) => {
        const lastMessage = thread.messages.at(-1);
        const haystack = [
          thread.customerName,
          thread.customerEmail,
          thread.customerPhone,
          thread.requestId,
          lastMessage?.text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    return sortChatThreadsByUnreadThenRecent(
      result,
      (thread) => thread.unreadForProvider || 0,
    );
  }, [filterTab, query, threads]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      filtered.find((item) => item.id === selectedId) ??
      threads.find((item) => item.id === selectedId) ??
      null
    );
  }, [filtered, selectedId, threads]);

  viewingThreadIdRef.current = selected?.id ?? null;
  providerActiveThreadIdRef.current = selected?.id ?? null;

  // Open mobile chat when a thread is selected
  useEffect(() => {
    if (selectedId) {
      setMobileChatOpen(true);
    }
  }, [selectedId]);

  // Mark thread read when opened (and again if unread arrives while viewing).
  const markReadCallbackRef = useRef(markRead);
  markReadCallbackRef.current = markRead;
  const markThreadReadCallbackRef = useRef(markThreadRead);
  markThreadReadCallbackRef.current = markThreadRead;
  const openedThreadIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!selected?.id) return;

    const unread = selected.unreadForProvider ?? 0;
    const hasUnreadMessages = selected.messages.some(
      (m) => m.from !== "provider" && !m.isRead,
    );
    const firstOpen = !openedThreadIdsRef.current.has(selected.id);
    const unreadKey = `${selected.id}:${unread}:${selected.messages.length}`;

    if (firstOpen) {
      openedThreadIdsRef.current.add(selected.id);
      lastMarkedThreadIdRef.current = unreadKey;
      markThreadReadCallbackRef.current(selected.id);
      markReadCallbackRef.current(selected.id);
      return;
    }

    if (
      (unread > 0 || hasUnreadMessages) &&
      lastMarkedThreadIdRef.current !== unreadKey
    ) {
      lastMarkedThreadIdRef.current = unreadKey;
      markThreadReadCallbackRef.current(selected.id);
      markReadCallbackRef.current(selected.id);
    }
  }, [
    selected?.id,
    selected?.messages?.length,
    selected?.unreadForProvider,
  ]);

  // Query live presence only when the set of customer IDs changes, not on every message
  const presenceIdsKey = useMemo(() => {
    const ids = Array.from(
      new Set(
        threads
          .map((t) => t.customerUserId)
          .filter((id): id is string => Boolean(id && /^[0-9a-fA-F]{24}$/.test(id))),
      ),
    ).sort();
    return ids.join(',');
  }, [threads]);

  useEffect(() => {
    if (!presenceIdsKey) return;
    queryUserPresence(presenceIdsKey.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceIdsKey]);

  // Real-time typing indicator listener for the active thread
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
        if (payload.threadId === selected.id && payload.from !== "provider") {
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
    joinThread(selected.id);
    return () => leaveThread(selected.id);
  }, [joinThread, leaveThread, selected?.id]);

  const participantPresence = selected?.customerUserId
    ? getPresence(selected.customerUserId)
    : undefined;
  const isParticipantOnline =
    selected?.id === ADMIN_DIRECT_THREAD_ID
      ? Boolean(supportOnline || selected?.isOnline)
      : Boolean(
          participantPresence?.isOnline ??
            selected?.presence?.customer?.isOnline ??
            selected?.isOnline ??
            false,
        );

  const unreadCount = useMemo(
    () => threads.filter((item) => item.unreadForProvider > 0).length,
    [threads],
  );

  const leadsCount = useMemo(
    () => threads.filter((item) => Boolean(item.requestId)).length,
    [threads],
  );

  if (loading && !threads.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <ChatWorkspaceSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {threads.length ? (
        <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
          {/* Left Sidebar: Threads Inbox */}
          <aside
            className={cn(
              "flex h-full w-full flex-col border-r border-border bg-card transition-all md:w-80 lg:w-[23rem]",
              mobileChatOpen && selected ? "hidden md:flex" : "flex",
            )}
          >
            {/* Sidebar Header */}
            <div className="flex flex-col gap-2.5 border-b border-border p-3 sm:p-4">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-semibold tracking-tight text-foreground">
                      Messages
                    </h1>
                    <span className="inline-flex h-5 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                      {threads.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refresh({ force: true, silent: false })}
                      title="Refresh messages"
                      aria-label="Refresh messages"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {unreadCount} unread
                  </span>
                ) : null}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts, messages…"
                  aria-label="Search contacts and messages"
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
                <button
                  type="button"
                  onClick={() => setFilterTab("leads")}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filterTab === "leads"
                      ? "bg-[#003F7D] text-white shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  Leads ({leadsCount})
                </button>
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {filtered.length ? (
                filtered.map((thread) => {
                  const active = selected?.id === thread.id;
                  const last = thread.messages.at(-1);
                  const lastTime = formatThreadTime(last?.at || thread.updatedAt);
                  const hasUnread = thread.unreadForProvider > 0;
                  const customerPresence = thread.customerUserId
                    ? getPresence(thread.customerUserId)
                    : undefined;
                  const isCustomerOnline =
                    thread.id === ADMIN_DIRECT_THREAD_ID
                      ? Boolean(supportOnline || thread.isOnline)
                      : Boolean(
                          customerPresence?.isOnline ??
                            thread.presence?.customer?.isOnline ??
                            thread.isOnline ??
                            false,
                        );

                  return (
                    <Link
                      key={thread.id}
                      href={
                        thread.id === ADMIN_DIRECT_THREAD_ID
                          ? `/pro/dashboard/messages?direct=admin`
                          : `/pro/dashboard/messages?thread=${thread.id}`
                      }
                      onClick={() => setMobileChatOpen(true)}
                      className={cn(
                        "group relative flex items-start gap-3 p-3 transition-colors text-left",
                        active
                          ? "bg-[#003F7D]/8 border-l-4 border-l-[#003F7D]"
                          : "hover:bg-muted/50",
                      )}
                    >
                      {/* Customer Avatar with status */}
                      <div className="relative shrink-0">
                        <Avatar className="size-10 shadow-2xs ring-1 ring-border">
                          {thread.customerAvatar ? (
                            <AvatarImage
                              src={thread.customerAvatar}
                              alt={thread.customerName}
                            />
                          ) : null}
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              getAvatarColor(thread.customerName),
                            )}
                          >
                            {getInitials(thread.customerName)}
                          </AvatarFallback>
                        </Avatar>
                        {isCustomerOnline ? (
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
                            {thread.customerName}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {hasUnread ? (
                              <span
                                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#003F7D] px-1.5 text-[10px] font-bold text-white shadow-xs"
                                aria-label={`${thread.unreadForProvider} unread`}
                              >
                                {thread.unreadForProvider}
                              </span>
                            ) : null}
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {lastTime}
                            </span>
                          </div>
                        </div>

                        {/* Middle row: Lead badge */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            {thread.requestId ? (
                              <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-medium text-[#003F7D] dark:bg-blue-950/60 dark:text-blue-300">
                                Lead inquiry
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Last Message Snippet */}
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {last ? (
                            <>
                              {last.from === "provider" ? (
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
                      : "No chats in this tab yet."}
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
            </div>
          </aside>

          {/* Right Main Area: Active Chat */}
          <main
            className={cn(
              "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background",
              !mobileChatOpen && selected ? "hidden md:flex" : "flex",
            )}
          >
            {selected ? (
              <div className="flex h-full min-h-0 flex-1 flex-col">
                {/* Chat Top Header */}
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-2xs">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Mobile Back to Threads Button */}
                    <button
                      type="button"
                      onClick={() => setMobileChatOpen(false)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                      aria-label="Back to conversations list"
                    >
                      <ArrowLeft className="size-5" />
                    </button>

                    {/* Customer Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className="size-10 shadow-2xs ring-1 ring-border">
                        {selected.customerAvatar ? (
                          <AvatarImage
                            src={selected.customerAvatar}
                            alt={selected.customerName}
                          />
                        ) : null}
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            getAvatarColor(selected.customerName),
                          )}
                        >
                          {getInitials(selected.customerName)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
                          isParticipantOnline ? "bg-emerald-500" : "bg-muted-foreground/35",
                        )}
                        aria-label={isParticipantOnline ? "Online" : "Offline"}
                      />
                    </div>

                    {/* Contact Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {selected.customerName}
                        </h2>
                        {isParticipantOnline ? (
                          <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : participantPresence?.lastSeen ? (
                          <span className="hidden text-[11px] text-muted-foreground sm:inline-flex">
                            Last seen {formatClockTime(participantPresence.lastSeen)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {selected.customerEmail ? (
                          <a
                            href={`mailto:${selected.customerEmail}`}
                            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                          >
                            <Mail className="size-3 shrink-0" />
                            <span className="max-w-44 truncate sm:max-w-xs">
                              {selected.customerEmail}
                            </span>
                          </a>
                        ) : null}

                        {selected.customerPhone ? (
                          <a
                            href={`tel:${selected.customerPhone}`}
                            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                          >
                            <Phone className="size-3 shrink-0" />
                            <span>{selected.customerPhone}</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {selected.requestId ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="hidden sm:inline-flex gap-1.5 text-xs font-medium"
                          asChild
                        >
                          <Link
                            href={`/pro/dashboard/requests/${selected.requestId}?tab=messages`}
                          >
                            <ExternalLink className="size-3.5" />
                            Lead dossier
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264] text-xs font-medium"
                          asChild
                        >
                          <Link
                            href={`/pro/dashboard/new-estimate/new?request=${selected.requestId}`}
                          >
                            <FilePlus2 className="size-3.5" />
                            <span className="hidden sm:inline">Write</span> Estimate
                          </Link>
                        </Button>
                      </>
                    ) : selected.customerId ? (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium" asChild>
                        <Link href={`/pro/dashboard/customers/${selected.customerId}`}>
                          <User className="size-3.5" />
                          Customer record
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </header>

                {/* Chat Panel with Messages */}
                <ChatPanel
                  messages={selected.messages}
                  self="provider"
                  recipientUnreadCount={
                    selected.id === ADMIN_DIRECT_THREAD_ID
                      ? (selected.unreadForAdmin ?? 0)
                      : selected.unreadForCustomer
                  }
                  otherName={
                    selected.id === ADMIN_DIRECT_THREAD_ID
                      ? "Platform Support"
                      : selected.customerName
                  }
                  otherAvatar={selected.customerAvatar}
                  isOtherTyping={isOtherTyping}
                  otherTypingName={
                    selected.id === ADMIN_DIRECT_THREAD_ID
                      ? "Platform Support"
                      : selected.customerName
                  }
                  onSend={async (text, attachments) => {
                    await send(selected.id, "provider", text, attachments);
                  }}
                  onTypingChange={(isTyping) => setTyping(selected.id, isTyping)}
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
                  Choose a chat from the left sidebar to review client requests, send quick quotes, and respond in real-time.
                </p>
              </div>
            )}
          </main>
        </div>
      ) : (
        /* Zero State when no threads exist at all */
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#003F7D]/10 text-[#003F7D]">
            <MessageSquare className="size-8" />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              No messages yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When customers contact you from your public profile or submit service inquiries, incoming chat conversations will appear here automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refresh({ force: true, silent: false })}
              className="gap-1.5"
            >
              <RotateCw className="size-3.5" />
              Refresh messages
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pro/dashboard/requests">View incoming leads</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

