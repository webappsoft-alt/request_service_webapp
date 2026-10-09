"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  customerNavGroups,
  isCustomerOverviewPath,
} from "@/lib/data/customer-nav";
import { customerPaths } from "@/lib/customer-paths";
import { ADMIN_DIRECT_THREAD_ID } from "@/lib/api/chat-client";
import { mapAdminDirectChat } from "@/lib/api/crm-mappers";
import type { ChatThread } from "@/lib/booking/chat-store";
import {
  markAllNotificationsRead,
  markNotificationRead,
  normalizeSocketNotification,
  notificationHref,
  type AppNotification,
} from "@/lib/api/notifications-client";
import {
  reopenCustomerInboxBadge,
  setCustomerInboxCleared,
} from "@/components/account/customer-inbox-clears";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { selectAuthUser, type AuthUser } from "@/store/authSlice";
import {
  allNotificationsMarkedRead,
  chatMessageReceived,
  chatReadReceipt,
  chatThreadUpserted,
  clearBadge,
  loadCustomerChatThreads,
  loadCustomerNotifications,
  notificationBadgeKind,
  notificationReceived,
  notificationsMarkedRead,
  selectCustomerBadgeIds,
  selectCustomerNotifications,
  selectCustomerUnreadMessages,
  selectCustomerUnreadNotifications,
  setUnreadNotifications,
  type CustomerBadgeKind,
} from "@/store/customerInboxSlice";
import { fetchCustomerChangeOrders } from "@/store/customerChangeOrdersSlice";

function RecordTab({
  href,
  label,
  active,
  onClose,
}: {
  href: string;
  label: string;
  active: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-8 max-w-52 shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 text-xs transition-colors",
        active
          ? "border-[#003F7D]/25 bg-[#e8eef5] font-semibold text-[#003F7D] shadow-[inset_0_-2px_0_#003F7D] dark:border-primary/40 dark:bg-primary/15 dark:text-primary dark:shadow-[inset_0_-2px_0_var(--primary)]"
          : "border-input bg-[#f7f8fa] text-muted-foreground hover:border-input hover:bg-white hover:text-foreground dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          active ? "bg-[#003F7D] dark:bg-primary" : "bg-black/25 dark:bg-white/30",
        )}
        aria-hidden
      />
      <Link href={href} className="min-w-0 truncate">
        {label}
      </Link>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-[3px] p-0.5 hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
          aria-label={`Close ${label}`}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

function getCurrentCustomerSection(pathname: string) {
  if (pathname.startsWith(customerPaths.requests)) {
    return { href: customerPaths.requests, label: "Quote Requests" };
  }
  if (pathname.startsWith(customerPaths.orders)) {
    return { href: customerPaths.orders, label: "Orders" };
  }
  if (pathname.startsWith(customerPaths.estimates)) {
    return { href: customerPaths.estimates, label: "Estimates" };
  }
  if (pathname.startsWith(customerPaths.changeOrders)) {
    return { href: customerPaths.changeOrders, label: "Change Orders" };
  }
  if (pathname.startsWith(customerPaths.invoices)) {
    return { href: customerPaths.invoices, label: "Invoices" };
  }
  if (pathname.startsWith(customerPaths.payments)) {
    return { href: customerPaths.payments, label: "Payments" };
  }
  if (pathname.startsWith(customerPaths.messages)) {
    return { href: customerPaths.messages, label: "Messages" };
  }
  if (pathname.startsWith(customerPaths.settings)) {
    return { href: customerPaths.settings, label: "Settings" };
  }
  return null;
}

function NavLinks({
  collapsed = false,
  closeOnNavigate = false,
  unreadMessages = 0,
  unreadEstimates = 0,
  unreadChangeOrders = 0,
  unreadInvoices = 0,
  unreadPayments = 0,
  unreadOrders = 0,
}: {
  collapsed?: boolean;
  closeOnNavigate?: boolean;
  unreadMessages?: number;
  unreadEstimates?: number;
  unreadChangeOrders?: number;
  unreadInvoices?: number;
  unreadPayments?: number;
  unreadOrders?: number;
}) {
  const pathname = usePathname();

  function badgeFor(href: string) {
    if (href === customerPaths.messages) return unreadMessages;
    if (href === customerPaths.estimates) return unreadEstimates;
    if (href === customerPaths.changeOrders) return unreadChangeOrders;
    if (href === customerPaths.invoices) return unreadInvoices;
    if (href === customerPaths.payments) return unreadPayments;
    if (href === customerPaths.orders) return unreadOrders;
    return 0;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col gap-4" aria-label="Customer dashboard">
        {customerNavGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label && !collapsed ? (
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.external
                ? false
                : item.href === customerPaths.dashboard
                  ? isCustomerOverviewPath(pathname)
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              const count = badgeFor(item.href);
              const link = (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    collapsed
                      ? count
                        ? `${item.label}, ${count}`
                        : item.label
                      : undefined
                  }
                  className={cn(
                    "relative flex items-center gap-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="size-4" aria-hidden="true" />
                    {collapsed && count > 0 ? (
                      <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold leading-none text-[#003F7D]">
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </span>
                  {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    item.label
                  )}
                  {!collapsed && count > 0 ? (
                    <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold leading-none text-[#003F7D]">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              );

              if (!collapsed) {
                return (
                  <span key={item.href} className="contents">
                    {closeOnNavigate ? (
                      <SheetClose asChild>{link}</SheetClose>
                    ) : (
                      link
                    )}
                  </span>
                );
              }

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}

/** Sidebar tabs whose badge resets when the customer opens them. */
const TAB_BADGES: Array<{
  href: string;
  kind: CustomerBadgeKind;
  openedEvent?: string;
}> = [
  { href: customerPaths.estimates, kind: "estimates", openedEvent: "CUSTOMER_ESTIMATES_TAB_OPENED" },
  { href: customerPaths.changeOrders, kind: "changeOrders" },
  { href: customerPaths.invoices, kind: "invoices", openedEvent: "CUSTOMER_INVOICES_TAB_OPENED" },
  { href: customerPaths.payments, kind: "payments", openedEvent: "CUSTOMER_PAYMENTS_TAB_OPENED" },
  { href: customerPaths.orders, kind: "orders", openedEvent: "CUSTOMER_ORDERS_TAB_OPENED" },
];

function badgeKindForPath(pathname: string): CustomerBadgeKind | null {
  return TAB_BADGES.find((tab) => pathname.startsWith(tab.href))?.kind ?? null;
}

function asPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const authUser = useAppSelector(selectAuthUser);
  const [collapsed, setCollapsed] = useState(false);
  const notifications = useAppSelector(selectCustomerNotifications);
  const unreadNotifications = useAppSelector(selectCustomerUnreadNotifications);
  const badgeIds = useAppSelector(selectCustomerBadgeIds);
  const unreadMessages = useAppSelector(selectCustomerUnreadMessages);
  const notificationsStatus = useAppSelector(
    (state) => state.customerInbox?.notificationsStatus ?? "idle",
  );
  const [headerSearch, setHeaderSearch] = useState("");
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const clearedKeyRef = useRef<string | null>(null);
  const customerEmail = String(authUser?.email || "").trim();

  const menuUser: AuthUser = authUser
    ? { ...authUser, role: authUser.role || "customer" }
    : { role: "customer" };

  const currentSection = getCurrentCustomerSection(pathname);

  // Load notifications + conversations once per session; the socket keeps them live.
  useEffect(() => {
    if (!authUser?.id && !customerEmail) return;
    void dispatch(loadCustomerNotifications());
  }, [authUser?.id, customerEmail, dispatch]);

  useEffect(() => {
    if (!customerEmail) return;
    void dispatch(loadCustomerChatThreads({ email: customerEmail }));
  }, [customerEmail, dispatch]);

  /** Mark this kind's unread notifications read (known ids only — no refetch). */
  const markKindRead = useCallback(
    (kind: CustomerBadgeKind) => {
      const unreadIds = (store.getState().customerInbox?.notifications ?? [])
        .filter((row) => !row.isRead && notificationBadgeKind(row) === kind)
        .map((row) => row.id);
      if (!unreadIds.length) return;
      dispatch(notificationsMarkedRead(unreadIds));
      void Promise.allSettled(unreadIds.map((id) => markNotificationRead(id)));
    },
    [dispatch, store],
  );

  // Opening a tab resets only that sidebar badge (and marks its notifications read).
  useEffect(() => {
    const tab = TAB_BADGES.find((item) => pathname.startsWith(item.href));
    if (!tab) {
      clearedKeyRef.current = null;
      return;
    }
    // Re-run once the first notification page lands so seeded badges clear too.
    const key = `${tab.kind}:${notificationsStatus}`;
    if (clearedKeyRef.current === key) return;
    clearedKeyRef.current = key;
    setCustomerInboxCleared(tab.kind, true);
    dispatch(clearBadge(tab.kind));
    markKindRead(tab.kind);
    if (tab.openedEvent) {
      window.dispatchEvent(
        new CustomEvent("rs-realtime", { detail: { type: tab.openedEvent } }),
      );
    }
  }, [dispatch, markKindRead, notificationsStatus, pathname]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      const payload = asPayload(detail?.payload);
      // The Messages page applies chat updates itself while it is open.
      const chatViewOpen = Boolean(store.getState().customerInbox?.chatViewMounted);

      if (type === "CHAT_THREAD_UPDATED") {
        if (chatViewOpen) return;
        const thread = detail.payload as ChatThread | undefined;
        if (
          thread?.id &&
          String(thread.customerEmail || "").toLowerCase() === customerEmail.toLowerCase()
        ) {
          dispatch(chatThreadUpserted(thread));
        }
        return;
      }
      if (type === "CHAT_MESSAGE") {
        if (chatViewOpen) return;
        const threadId = String(payload.threadId || "");
        const message = asPayload(payload.message);
        if (!threadId || !Object.keys(message).length) return;
        const known = (store.getState().customerInbox?.chatThreads ?? []).some(
          (thread) => thread.id === threadId,
        );
        if (known) {
          dispatch(chatMessageReceived({ threadId, message }));
        } else if (payload.thread) {
          dispatch(chatThreadUpserted(payload.thread as ChatThread));
        } else if (customerEmail) {
          // A conversation we have never seen — pull the first page once.
          void dispatch(loadCustomerChatThreads({ email: customerEmail, force: true }));
        }
        return;
      }
      if (type === "CHAT_READ_RECEIPT") {
        if (chatViewOpen) return;
        const threadId = String(payload.threadId || "");
        if (!threadId) return;
        dispatch(
          chatReadReceipt({
            threadId,
            readBy: String(payload.readBy || ""),
            unreadForCustomer: Number(payload.unreadForCustomer) || 0,
            unreadForProvider: Number(payload.unreadForProvider) || 0,
          }),
        );
        return;
      }
      if (type === "DIRECT_CHAT_MESSAGE") {
        if (chatViewOpen) return;
        const mapped = payload.chat ? mapAdminDirectChat(payload.chat, "customer") : null;
        if (mapped) dispatch(chatThreadUpserted(mapped));
        return;
      }
      if (type === "DIRECT_CHAT_READ") {
        if (chatViewOpen) return;
        const readBy = String(payload.readBy || "");
        if (readBy === "customer" || readBy === "provider") {
          dispatch(
            chatReadReceipt({
              threadId: ADMIN_DIRECT_THREAD_ID,
              readBy: "customer",
              unreadForCustomer: Number(payload.unreadForPeer) || 0,
            }),
          );
        }
        return;
      }
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (!mapped) return;
        const isChatMsg = String(mapped.type || "") === "NEW_CHAT_MESSAGE";
        const viewingThisChat =
          typeof window !== "undefined" &&
          window.location.pathname.includes("/messages") &&
          (() => {
            const params = new URLSearchParams(window.location.search);
            const directAdmin =
              params.get("direct") === "admin" ||
              params.get("thread") === "admin-direct";
            const openThread = params.get("thread") || "";
            const notifThread = String(
              mapped.data?.threadId || mapped.data?.chatId || "",
            );
            const href = String(mapped.href || mapped.data?.href || "");
            const isAdminDirectNotif =
              mapped.data?.direct === true ||
              mapped.data?.tab === "direct" ||
              href.includes("direct=admin") ||
              notifThread === "admin-direct";
            if (directAdmin && isAdminDirectNotif) return true;
            if (openThread && notifThread && openThread === notifThread) return true;
            if (openThread && href.includes(`thread=${openThread}`)) return true;
            return false;
          })();
        if (isChatMsg && viewingThisChat) {
          dispatch(notificationReceived({ notification: { ...mapped, isRead: true } }));
          return;
        }
        const kind = notificationBadgeKind(mapped);
        // Already on that tab — record it as read instead of raising its badge.
        const onThatTab = Boolean(kind && kind === badgeKindForPath(pathnameRef.current));
        if (onThatTab && !mapped.isRead) {
          dispatch(notificationReceived({ notification: { ...mapped, isRead: true } }));
          void markNotificationRead(mapped.id).catch(() => undefined);
        } else {
          if (kind && !mapped.isRead) reopenCustomerInboxBadge(kind);
          dispatch(notificationReceived({ notification: mapped }));
        }
        if (kind === "changeOrders") void dispatch(fetchCustomerChangeOrders());
        return;
      }
      if (type === "CHANGE_ORDER_REQUESTED" || type === "CHANGE_ORDER_RESPONDED") {
        // Badge comes from the persisted NEW_NOTIFICATION; refresh the Orders highlight.
        void dispatch(fetchCustomerChangeOrders());
        return;
      }
      if (type === "SOCKET_RECONNECTED" || type === "CUSTOMER_BADGE_INVALIDATE") {
        // Events may have been missed while offline — re-sync once.
        void dispatch(loadCustomerNotifications({ force: true }));
        if (customerEmail && type === "SOCKET_RECONNECTED") {
          void dispatch(loadCustomerChatThreads({ email: customerEmail, force: true }));
        }
      }
      // INVOICE_SENT / PAYMENT_RECEIVED / ESTIMATE_* / ORDER_UPDATED each arrive
      // together with a NEW_NOTIFICATION — counting them here too caused the "2" badge.
    });
  }, [customerEmail, dispatch, store]);

  const unreadEstimates = badgeIds.estimates.length;
  const unreadChangeOrders = badgeIds.changeOrders.length;
  const unreadInvoices = badgeIds.invoices.length;
  const unreadPayments = badgeIds.payments.length;
  const unreadOrders = badgeIds.orders.length;
  // Header notification count only — messages stay on the sidebar.
  const bellCount = unreadNotifications;

  async function onOpenNotification(item: AppNotification) {
    const href = notificationHref(item);
    if (!item.isRead) {
      dispatch(notificationsMarkedRead([item.id]));
      try {
        const result = await markNotificationRead(item.id);
        dispatch(setUnreadNotifications(result.unreadCount));
      } catch {
        // still navigate
      }
    }
    router.push(href);
  }

  async function onMarkAllRead() {
    // Header only — sidebar badges reset when their tab is opened.
    dispatch(allNotificationsMarkedRead());
    try {
      await markAllNotificationsRead();
    } catch {
      void dispatch(loadCustomerNotifications({ force: true }));
    }
  }

  return (
    <div className="portal-app min-h-svh bg-[#eef1f5] dark:bg-background">
      {/* Sidebar matching Provider Portal style */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#003F7D] dark:bg-slate-900 dark:border-r dark:border-border text-white transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex h-12 items-center border-b border-white/10",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <Link
            href={customerPaths.dashboard}
            className="truncate text-sm font-semibold tracking-wide"
          >
            {collapsed ? "RS" : "Customer Dashboard"}
          </Link>
        </div>
        <div
          className={cn(
            "flex-1 overflow-y-auto py-3",
            collapsed ? "px-2" : "px-2",
          )}
        >
          <NavLinks
            collapsed={collapsed}
            unreadMessages={unreadMessages}
            unreadEstimates={unreadEstimates}
            unreadChangeOrders={unreadChangeOrders}
            unreadInvoices={unreadInvoices}
            unreadPayments={unreadPayments}
            unreadOrders={unreadOrders}
          />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="border-t border-white/10 px-3 py-3 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? "Show" : "Hide labels"}
        </button>
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-56",
        )}
      >
        {/* Header matching Provider Portal style */}
        <header className="sticky top-0 z-20 border-b border-input bg-card">
          <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open customer menu"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col border-0 bg-[#003F7D] dark:bg-slate-900 dark:border-r dark:border-border p-0 text-white"
              >
                <SheetHeader className="border-b border-white/10 px-4 py-3">
                  <SheetTitle className="text-white">
                    Customer Dashboard
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                  <NavLinks
                    closeOnNavigate
                    unreadMessages={unreadMessages}
                    unreadEstimates={unreadEstimates}
                    unreadChangeOrders={unreadChangeOrders}
                    unreadInvoices={unreadInvoices}
                    unreadPayments={unreadPayments}
                    unreadOrders={unreadOrders}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleUserLogout()}
                  className="flex items-center gap-2 border-t border-white/10 px-3 py-3 text-left text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-3.5 shrink-0" />
                  Log out
                </button>
              </SheetContent>
            </Sheet>

            {/* Provider-style Record Tabs */}
            <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto md:flex">
              <RecordTab
                href={customerPaths.dashboard}
                label="Customer Dashboard"
                active={isCustomerOverviewPath(pathname)}
              />
              {currentSection ? (
                <RecordTab
                  href={currentSection.href}
                  label={currentSection.label}
                  active={true}
                />
              ) : null}
            </div>

            {/* Provider-style Header Search */}
            <div className="relative ml-auto hidden w-56 lg:block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search records…"
                className="h-8 bg-[#f7f8fa] dark:bg-slate-800/80 pl-8 text-sm border-input"
                aria-label="Search records"
                value={headerSearch}
                onChange={(event) => setHeaderSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const q = headerSearch.trim();
                  if (!q) return;
                  router.push(`${customerPaths.estimates}?q=${encodeURIComponent(q)}`);
                }}
              />
            </div>

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    className="relative size-8"
                  >
                    <Bell className="size-4" />
                    {bellCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white">
                        {bellCount > 99 ? "99+" : bellCount}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between text-xs">
                    <span>Notifications</span>
                    {unreadNotifications > 0 ? (
                      <button
                        type="button"
                        className="text-[10px] font-medium text-primary hover:underline"
                        onClick={() => void onMarkAllRead()}
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    notifications.slice(0, 8).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className="flex cursor-pointer flex-col items-start gap-0.5 py-2 text-xs"
                        onSelect={(event) => {
                          event.preventDefault();
                          void onOpenNotification(item);
                        }}
                      >
                        <span className={cn("font-medium", !item.isRead && "text-foreground")}>
                          {item.title}
                        </span>
                        <span className="line-clamp-2 text-muted-foreground">{item.message}</span>
                      </DropdownMenuItem>
                    ))
                  ) : unreadMessages > 0 ? (
                    <DropdownMenuItem asChild>
                      <Link
                        href={customerPaths.messages}
                        className="flex items-center justify-between text-xs"
                      >
                        <span>Unread messages</span>
                        <Badge className="bg-[#003F7D] text-white text-[10px]">
                          {unreadMessages}
                        </Badge>
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No unread notifications.
                    </p>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={customerPaths.messages} className="text-xs">
                      Open messages
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex h-8 text-xs"
              >
                <Link href={customerPaths.site}>Back to site</Link>
              </Button>
              <ThemeToggle />
              <UserAccountMenu user={menuUser} className="size-8 border-input" />
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
