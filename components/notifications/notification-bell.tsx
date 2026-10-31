"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { useSocket } from "@/components/socket/SocketProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  normalizeSocketNotification,
  type AppNotification,
} from "@/lib/api/notifications-client";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  loadMoreNotifications,
  loadNotificationFeed,
  markFeedAllRead,
  markFeedItemRead,
  notificationArrived,
  notificationsReadElsewhere,
  selectNotificationFeed,
} from "@/store/notificationFeedSlice";

/** Re-sync when the tab comes back after this long (events can be missed while asleep). */
const RESYNC_AFTER_MS = 30_000;
/** First load when the live connection hasn't come up by then. */
const FIRST_LOAD_FALLBACK_MS = 3_000;

/** True when this chat notification is for the conversation open on screen right now. */
export function isViewingNotificationChat(item: AppNotification) {
  if (typeof window === "undefined" || item.type !== "NEW_CHAT_MESSAGE") return false;
  if (!window.location.pathname.includes("/messages")) return false;
  const params = new URLSearchParams(window.location.search);
  const directAdmin = params.get("direct") === "admin" || params.get("thread") === "admin-direct";
  const openThread = params.get("thread") || "";
  const notifThread = String(item.data?.threadId || item.data?.chatId || "");
  const href = String(item.href || item.data?.href || "");
  const isAdminDirectNotif =
    item.data?.direct === true ||
    item.data?.tab === "direct" ||
    href.includes("direct=admin") ||
    notifThread === "admin-direct";
  if (directAdmin && isAdminDirectNotif) return true;
  if (openThread && notifThread && openThread === notifThread) return true;
  if (openThread && href.includes(`thread=${openThread}`)) return true;
  return false;
}

function ago(iso?: string) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type NotificationBellProps = {
  /** Where an item opens in this portal. */
  hrefFor: (item: AppNotification) => string;
  title?: string;
  itemTitle?: (item: AppNotification) => string;
  /** Items to mark read as soon as they arrive (e.g. the chat open on screen). */
  autoReadWhen?: (item: AppNotification) => boolean;
  /** Keep a portal's own badges in step when the bell marks items read. */
  onItemsRead?: (ids: string[]) => void;
  onAllRead?: () => void;
  emptyText?: string;
  buttonClassName?: string;
  iconClassName?: string;
};

/** Header bell used by every portal; the list and count live in `notificationFeed`. */
export function NotificationBell({
  hrefFor,
  title = "Notifications",
  itemTitle = (item) => item.title,
  autoReadWhen,
  onItemsRead,
  onAllRead,
  emptyText = "You're all caught up.",
  buttonClassName,
  iconClassName,
}: NotificationBellProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const feed = useAppSelector(selectNotificationFeed);
  const [open, setOpen] = useState(false);

  // Latest callbacks for the socket handler, without resubscribing on every render.
  const callbacks = useRef({ autoReadWhen, onItemsRead, onAllRead });
  useEffect(() => {
    callbacks.current = { autoReadWhen, onItemsRead, onAllRead };
  });
  const loadedAtRef = useRef(feed.loadedAt);
  useEffect(() => {
    loadedAtRef.current = feed.loadedAt;
  }, [feed.loadedAt]);

  // Badge count on first paint (not only once the dropdown is opened). While the socket is
  // still connecting, its connect re-sync (SOCKET_RECONNECTED below) is that first load, so the
  // list isn't fetched twice; the timer covers a socket that doesn't connect.
  const { isConnected } = useSocket();
  useEffect(() => {
    if (isConnected) {
      void dispatch(loadNotificationFeed());
      return;
    }
    const timer = setTimeout(() => void dispatch(loadNotificationFeed()), FIRST_LOAD_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [dispatch, isConnected]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      const payload = (detail?.payload ?? {}) as Record<string, unknown>;
      if (type === "NEW_NOTIFICATION") {
        const item = normalizeSocketNotification(payload);
        if (!item) return;
        const count = Number(payload.unreadCount);
        dispatch(
          notificationArrived({
            item,
            unreadCount: payload.unreadCount == null || !Number.isFinite(count) ? undefined : count,
          }),
        );
        if (!item.isRead && callbacks.current.autoReadWhen?.(item)) {
          void dispatch(markFeedItemRead(item.id));
          callbacks.current.onItemsRead?.([item.id]);
        }
        return;
      }
      if (type === "NOTIFICATIONS_READ") {
        const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : undefined;
        const count = Number(payload.unreadCount);
        dispatch(
          notificationsReadElsewhere({
            ids,
            all: payload.all === true,
            unreadCount: payload.unreadCount == null || !Number.isFinite(count) ? undefined : count,
          }),
        );
        if (payload.all === true) callbacks.current.onAllRead?.();
        else if (ids?.length) callbacks.current.onItemsRead?.(ids);
        return;
      }
      if (type === "SOCKET_RECONNECTED") {
        // Events may have been missed while offline.
        void dispatch(loadNotificationFeed({ force: true }));
      }
    });
  }, [dispatch]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAtRef.current < RESYNC_AFTER_MS) return;
      void dispatch(loadNotificationFeed({ force: true }));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [dispatch]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Opening shows the newest 10 again.
    if (next) void dispatch(loadNotificationFeed({ force: true }));
  }

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 64) {
      void dispatch(loadMoreNotifications());
    }
  }

  function openItem(item: AppNotification) {
    if (!item.isRead) {
      void dispatch(markFeedItemRead(item.id));
      onItemsRead?.([item.id]);
    }
    setOpen(false);
    router.push(hrefFor(item));
  }

  function markAll() {
    void dispatch(markFeedAllRead())
      .unwrap()
      .catch(() => dispatch(loadNotificationFeed({ force: true })));
    onAllRead?.();
  }

  const unread = feed.unread;
  const firstLoad = feed.status === "loading" && !feed.items.length;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn("relative", buttonClassName)}
        >
          <Bell className={iconClassName} />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2">
          <span>
            {title}
            {unread > 0 ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{unread} unread</span>
            ) : null}
          </span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={markAll}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto overscroll-contain" onScroll={onScroll}>
          {firstLoad ? (
            <div className="space-y-3 px-3 py-3" aria-label="Loading notifications">
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-1.5">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : feed.items.length ? (
            <>
              {feed.items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className="flex cursor-pointer items-start gap-2 rounded-none px-3 py-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    openItem(item);
                  }}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.isRead ? "bg-transparent" : "bg-[#c2410c]",
                    )}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          item.isRead ? "text-muted-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {itemTitle(item)}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {ago(item.createdAt)}
                      </span>
                    </span>
                    {item.message ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.message}</span>
                    ) : null}
                    {!item.isRead ? <span className="sr-only">Unread</span> : null}
                  </span>
                </DropdownMenuItem>
              ))}
              {feed.loadingMore ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Loading older notifications…
                </div>
              ) : !feed.hasMore && feed.items.length > 10 ? (
                <p className="py-3 text-center text-[11px] text-muted-foreground">
                  That&apos;s everything.
                </p>
              ) : null}
            </>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {feed.status === "failed" ? "Couldn't load notifications." : emptyText}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
