"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import {
  type AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeSocketNotification,
  notificationHref,
} from "@/lib/api/notifications-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function providerTitle(item: AppNotification) {
  if (item.type === "NEW_LEAD") return "New lead";
  if (item.type === "NEW_CHAT_MESSAGE") return "New message";
  if (item.type === "NEW_BOOKING_REQUEST") return "New booking request";
  if (item.type === "BOOKING_ACCEPTED") return "Booking accepted";
  if (item.type === "BOOKING_REJECTED") return "Booking declined";
  return item.title.replace(/^New quote request$/i, "New lead");
}

function leadFallbackNotification(payload: Record<string, unknown> | undefined): AppNotification | null {
  if (!payload) return null;
  const id = String(payload.id || payload.requestId || "").trim();
  if (!id) return null;
  const number = String(payload.number || "").trim();
  const customerName = String(payload.customerName || "Customer").trim();
  const serviceName = String(payload.serviceName || "a service").trim();
  const href =
    (typeof payload.href === "string" && payload.href) ||
    `/pro/dashboard/requests/${id}`;
  return {
    id: `lead:${id}`,
    type: "NEW_LEAD",
    title: "New lead",
    message: number
      ? `${number} — ${customerName} requested ${serviceName}`
      : `${customerName} requested ${serviceName}`,
    data: { ...payload, href },
    isRead: false,
    createdAt: new Date().toISOString(),
    href,
  };
}

function bookingFallbackNotification(
  payload: Record<string, unknown> | undefined,
): AppNotification | null {
  if (!payload) return null;
  const status = String(payload.status || "");
  const action = String(payload.action || "");
  if (status !== "BOOKING_REQUESTED" && action !== "requested") return null;
  const id = String(payload.id || payload.orderId || "").trim();
  const number = String(payload.number || "").trim();
  if (!id && !number) return null;
  const href =
    (typeof payload.href === "string" && payload.href) || "/pro/dashboard/orders";
  return {
    id: `booking:${id || number}`,
    type: "NEW_BOOKING_REQUEST",
    title: "New booking request",
    message: number
      ? `${number} needs your review.`
      : "A customer requested a booking.",
    data: { ...payload, href },
    isRead: false,
    createdAt: new Date().toISOString(),
    href,
  };
}

export function PortalNotifications() {
  const inbox = usePortalInbox();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshNotifications = useCallback(async () => {
    try {
      const result = await fetchNotifications({
        page: 1,
        limit: 30,
        status: "all",
        silent: true,
        force: true,
      });
      setNotifications(result.items);
      setUnreadNotifications(result.unreadCount);
    } catch {
      /* keep last known feed */
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (mapped) {
          const isChatMsg = String(mapped.type || "") === "NEW_CHAT_MESSAGE";
          const viewingAdminDirect =
            typeof window !== "undefined" &&
            window.location.pathname.includes("/messages") &&
            (new URLSearchParams(window.location.search).get("direct") === "admin" ||
              new URLSearchParams(window.location.search).get("thread") === "admin-direct");

          setNotifications((current) => {
            if (current.some((row) => row.id === mapped.id)) return current;
            const entry =
              isChatMsg && viewingAdminDirect
                ? { ...mapped, isRead: true }
                : mapped;
            return [entry, ...current].slice(0, 30);
          });
          if (!mapped.isRead && !(isChatMsg && viewingAdminDirect)) {
            setUnreadNotifications((count) => count + 1);
          }
          return;
        }
        void refreshNotifications();
        return;
      }

      if (type === "DIRECT_CHAT_READ") {
        void refreshNotifications();
        return;
      }

      if (type === "LEAD_CREATED") {
        const fallback = leadFallbackNotification(
          detail.payload && typeof detail.payload === "object"
            ? (detail.payload as Record<string, unknown>)
            : undefined,
        );
        if (fallback) {
          setNotifications((current) => {
            if (
              current.some(
                (row) =>
                  row.id === fallback.id ||
                  String(row.data?.requestId || "") === String(fallback.data?.id || ""),
              )
            ) {
              return current;
            }
            return [fallback, ...current].slice(0, 30);
          });
          setUnreadNotifications((count) => count + 1);
        }
        void refreshNotifications();
        return;
      }

      if (type === "ORDER_UPDATED") {
        const fallback = bookingFallbackNotification(
          detail.payload && typeof detail.payload === "object"
            ? (detail.payload as Record<string, unknown>)
            : undefined,
        );
        if (fallback) {
          setNotifications((current) => {
            if (
              current.some(
                (row) =>
                  row.id === fallback.id ||
                  (row.type === "NEW_BOOKING_REQUEST" &&
                    String(fallback.data?.number || "") !== "" &&
                    String(row.data?.number || row.message || "").includes(
                      String(fallback.data?.number || ""),
                    )),
              )
            ) {
              return current;
            }
            return [fallback, ...current].slice(0, 30);
          });
          setUnreadNotifications((count) => count + 1);
        }
        void refreshNotifications();
        return;
      }

      if (type === "LEADS_TAB_OPENED") {
        setNotifications((current) => {
          const next = current.map((row) =>
            row.type === "NEW_LEAD"
              ? { ...row, isRead: true, readAt: new Date().toISOString() }
              : row,
          );
          setUnreadNotifications(next.filter((row) => !row.isRead).length);
          return next;
        });
        return;
      }

      if (type === "ORDERS_TAB_OPENED") {
        setNotifications((current) => {
          const next = current.map((row) =>
            row.type === "NEW_BOOKING_REQUEST" ||
            (/BOOKING|ORDER/i.test(row.type) &&
              /request|review|booked/i.test(`${row.title} ${row.message}`))
              ? { ...row, isRead: true, readAt: new Date().toISOString() }
              : row,
          );
          setUnreadNotifications(next.filter((row) => !row.isRead).length);
          return next;
        });
        return;
      }

      if (
        type === "INBOX_SUMMARY_INVALIDATE" ||
        type === "ORDER_UPDATED" ||
        type === "CHAT_MESSAGE" ||
        type === "CHAT_THREAD_UPDATED"
      ) {
        void refreshNotifications();
      }
    });
  }, [refreshNotifications]);

  useEffect(() => {
    if (open) void refreshNotifications();
  }, [open, refreshNotifications]);

  const unreadFromList = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );
  const bellCount = Math.max(unreadFromList, unreadNotifications, inbox.total);

  const historyItems =
    notifications.length > 0
      ? notifications
      : inbox.items.map((item) => ({
          id: item.id,
          type: item.kind === "chat" ? "NEW_CHAT_MESSAGE" : "NEW_LEAD",
          title: item.kind === "chat" ? "New message" : "New lead",
          message: item.detail,
          data: { href: item.href },
          isRead: false,
          href: item.href,
        }));

  async function onOpenNotification(item: AppNotification) {
    const href = notificationHref(item, "provider");
    if (!item.isRead && !item.id.startsWith("lead:")) {
      try {
        const result = await markNotificationRead(item.id);
        setUnreadNotifications(result.unreadCount);
        setNotifications((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, isRead: true, readAt: new Date().toISOString() }
              : row,
          ),
        );
      } catch {
        // still navigate
      }
    } else if (!item.isRead) {
      setNotifications((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, isRead: true, readAt: new Date().toISOString() }
            : row,
        ),
      );
      setUnreadNotifications((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    router.push(href);
  }

  async function onMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadNotifications(0);
      setNotifications((current) =>
        current.map((row) => ({
          ...row,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
    } catch {
      // ignore
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {bellCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white">
              {bellCount > 99 ? "99+" : bellCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2">
          <span>Inbox</span>
          {bellCount > 0 ? (
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:underline"
              onClick={() => void onMarkAllRead()}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-56 overflow-y-auto overscroll-contain">
          {historyItems.length ? (
            historyItems.slice(0, 20).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2"
                onSelect={(event) => {
                  event.preventDefault();
                  void onOpenNotification(item);
                }}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    !item.isRead ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {providerTitle(item)}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{item.message}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No new leads or chats.</p>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex flex-col py-1">
          <DropdownMenuItem asChild className="rounded-none px-3 py-1.5 text-xs">
            <Link href="/pro/dashboard/messages">Open messages</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-none px-3 py-1.5 text-xs">
            <Link href="/pro/dashboard/requests?status=new">Open new leads</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
