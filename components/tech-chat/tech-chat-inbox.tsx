"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Briefcase, FileText, MessageSquare, Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { onSocketEvent } from "@/components/socket/socket-api";
import { TechChatConversation } from "@/components/tech-chat/tech-chat-conversation";
import { rememberTechChatThread } from "@/components/tech-chat/use-tech-chat-unread";
import {
  TECH_CHAT_PAGE_SIZE,
  listTechChats,
  techChatContextLabel,
  type TechChatSide,
  type TechChatThread,
} from "@/lib/api/technician-chat-client";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function when(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const CONTEXT_ICON = { job: Briefcase, estimate: FileText, payment: Wallet, general: MessageSquare } as const;

/**
 * Inbox of technician ↔ provider threads: list on the left, conversation on
 * the right (stacked on phones). The list re-sorts live as messages arrive.
 */
export function TechChatInbox({
  side,
  initialThreadId,
  onSelect,
  className,
}: {
  side: TechChatSide;
  initialThreadId?: string | null;
  /** Keeps the URL in sync with the open thread. */
  onSelect?: (threadId: string | null) => void;
  className?: string;
}) {
  const [threads, setThreads] = useState<TechChatThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialThreadId ?? null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Paging: 10 conversations per page, next page loads when the list is scrolled to the end.
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0, unread: 0 });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryKey = `${side}|${debouncedSearch}|${unreadOnly ? 1 : 0}`;
  const loading = loadedKey !== queryKey;
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const unreadOf = useCallback(
    (thread: TechChatThread) => (side === "technician" ? thread.unreadForTechnician : thread.unreadForProvider) || 0,
    [side],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // First page whenever the side, search or unread filter changes.
  useEffect(() => {
    let cancelled = false;
    listTechChats(side, { page: 1, limit: TECH_CHAT_PAGE_SIZE, search: debouncedSearch, unread: unreadOnly })
      .then((result) => {
        if (cancelled) return;
        setThreads(result.threads);
        setPaging({ page: result.page, totalPages: result.totalPages, total: result.total, unread: result.unread });
        result.threads.forEach((row) => rememberTechChatThread(side, row));
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(`${side}|${debouncedSearch}|${unreadOnly ? 1 : 0}`);
      });
    return () => {
      cancelled = true;
    };
  }, [side, debouncedSearch, unreadOnly]);

  const hasMore = !loading && paging.page < paging.totalPages;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const key = queryKey;
    try {
      const result = await listTechChats(side, {
        page: paging.page + 1,
        limit: TECH_CHAT_PAGE_SIZE,
        search: debouncedSearch,
        unread: unreadOnly,
      });
      if (key !== queryKey) return;
      // Append the next page; skip rows already shown (live messages may have moved them up).
      setThreads((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...result.threads.filter((row) => !seen.has(row.id))];
      });
      setPaging({ page: result.page, totalPages: result.totalPages, total: result.total, unread: result.unread });
      result.threads.forEach((row) => rememberTechChatThread(side, row));
    } catch {
      // keep what is loaded; scrolling again retries
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, queryKey, side, paging.page, debouncedSearch, unreadOnly]);

  // Load the next page when the end of the list scrolls into view (also fills a tall list).
  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, threads.length]);

  // Follow the URL when it points at another thread (e.g. a notification link).
  const [urlThreadId, setUrlThreadId] = useState(initialThreadId ?? null);
  if ((initialThreadId ?? null) !== urlThreadId) {
    setUrlThreadId(initialThreadId ?? null);
    if (initialThreadId) setSelectedId(initialThreadId);
  }

  useEffect(() => {
    const offMessage = onSocketEvent("techchat:message", (payload) => {
      if (!payload?.thread) return;
      setThreads((current) => {
        const rest = current.filter((row) => row.id !== payload.thread.id);
        const next = { ...payload.thread };
        // The open thread is being read right now.
        if (next.id === selectedId) {
          if (side === "technician") next.unreadForTechnician = 0;
          else next.unreadForProvider = 0;
        }
        return [next, ...rest];
      });
    });
    const offRead = onSocketEvent("techchat:read", (payload) => {
      if (payload?.reader !== side) return;
      setThreads((current) =>
        current.map((row) =>
          row.id === payload.threadId
            ? side === "technician"
              ? { ...row, unreadForTechnician: 0 }
              : { ...row, unreadForProvider: 0 }
            : row,
        ),
      );
    });
    return () => {
      offMessage();
      offRead();
    };
  }, [side, selectedId]);

  // Search and the unread filter run on the server; only hide rows read since loading.
  const visible = unreadOnly ? threads.filter((row) => unreadOf(row) > 0 || row.id === selectedId) : threads;

  function select(id: string | null) {
    setSelectedId(id);
    onSelect?.(id);
    if (id) {
      setThreads((current) =>
        current.map((row) =>
          row.id === id
            ? side === "technician"
              ? { ...row, unreadForTechnician: 0 }
              : { ...row, unreadForProvider: 0 }
            : row,
        ),
      );
    }
  }

  const liveUnread = threads.reduce((sum, row) => sum + unreadOf(row), 0);
  const totalUnread = Math.max(liveUnread, paging.page >= paging.totalPages ? liveUnread : paging.unread);

  return (
    <div
      className={cn(
        "grid h-[calc(100svh-9rem)] min-h-[28rem] overflow-hidden rounded-xl border border-input bg-white md:grid-cols-[20rem_1fr] lg:grid-cols-[23rem_1fr]",
        className,
      )}
    >
      <div className={cn("flex min-h-0 flex-col border-input md:border-r", selectedId && "hidden md:flex")}>
        <div className="space-y-2 border-b border-input p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={side === "technician" ? "Search jobs, estimates…" : "Search technicians, jobs…"}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { key: false, label: unreadOnly ? "All" : `All (${paging.total})` },
              { key: true, label: `Unread (${totalUnread})` },
            ].map((tab) => (
              <button
                key={String(tab.key)}
                type="button"
                onClick={() => setUnreadOnly(tab.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  unreadOnly === tab.key ? "bg-[#003F7D] text-white" : "bg-[#f1f5f9] text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length ? (
            visible.map((row) => {
              const Icon = CONTEXT_ICON[row.contextType] ?? MessageSquare;
              const unread = unreadOf(row);
              const name = side === "technician" ? row.providerName || "Office" : row.technicianName || "Technician";
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => select(row.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-input px-3 py-3 text-left transition-colors",
                    row.id === selectedId ? "bg-[#eef3f9]" : "hover:bg-[#f6f9fc]",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#003F7D]/10 text-xs font-semibold text-[#003F7D]">
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium")}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(row.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#003F7D]">
                      <Icon className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{techChatContextLabel(row)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                        {row.lastMessageText || "No messages yet"}
                      </span>
                      {unread ? (
                        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {debouncedSearch || unreadOnly
                ? "No conversations match."
                : side === "technician"
                  ? "No conversations yet. Use Chat on a job, estimate or payment to message the office."
                  : "No technician conversations yet."}
            </p>
          )}
          {hasMore ? <div ref={sentinelRef} className="h-px" aria-hidden /> : null}
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Spinner className="size-3.5" /> Loading more conversations…
            </div>
          ) : hasMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="w-full py-3 text-xs font-medium text-[#003F7D] hover:underline"
            >
              Load more ({threads.length} of {paging.total})
            </button>
          ) : !loading && threads.length > TECH_CHAT_PAGE_SIZE ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">All {paging.total} conversations loaded</p>
          ) : null}
        </div>
      </div>

      <div className={cn("flex min-h-0 min-w-0 flex-col", !selectedId && "hidden md:flex")}>
        {selectedId ? (
          <>
            <div className="border-b border-input px-2 py-1.5 md:hidden">
              <Button variant="ghost" size="sm" onClick={() => select(null)}>
                <ArrowLeft /> All conversations
              </Button>
            </div>
            <TechChatConversation key={selectedId} side={side} threadId={selectedId} className="flex-1" />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#eef3f9] text-[#003F7D]">
              <MessageSquare className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">Select a conversation</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {side === "technician"
                  ? "Messages with the office about your jobs, estimates and pay."
                  : "Messages from your technicians about the jobs and estimates they are assigned."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
