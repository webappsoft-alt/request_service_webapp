"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
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
import { listPublicChatThreads } from "@/lib/api/chat-client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeSocketNotification,
  notificationHref,
  type AppNotification,
} from "@/lib/api/notifications-client";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser, type AuthUser } from "@/store/authSlice";

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
          ? "border-[#003F7D]/25 bg-[#e8eef5] font-semibold text-[#003F7D] shadow-[inset_0_-2px_0_#003F7D]"
          : "border-black/10 bg-[#f7f8fa] text-muted-foreground hover:border-black/20 hover:bg-white hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          active ? "bg-[#003F7D]" : "bg-black/25",
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
          className="rounded-[3px] p-0.5 hover:bg-black/10 hover:text-foreground"
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
  if (pathname.startsWith(customerPaths.invoices)) {
    return { href: customerPaths.invoices, label: "Invoices" };
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
  unreadInvoices = 0,
  unreadOrders = 0,
}: {
  collapsed?: boolean;
  closeOnNavigate?: boolean;
  unreadMessages?: number;
  unreadEstimates?: number;
  unreadInvoices?: number;
  unreadOrders?: number;
}) {
  const pathname = usePathname();

  function badgeFor(href: string) {
    if (href === customerPaths.messages) return unreadMessages;
    if (href === customerPaths.estimates) return unreadEstimates;
    if (href === customerPaths.invoices) return unreadInvoices;
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

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAppSelector(selectAuthUser);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [headerSearch, setHeaderSearch] = useState("");

  const menuUser: AuthUser = authUser
    ? { ...authUser, role: authUser.role || "customer" }
    : { role: "customer" };

  const currentSection = getCurrentCustomerSection(pathname);

  const refreshChatBadge = useCallback(async () => {
    const email = String(authUser?.email || "").trim();
    if (!email) {
      setUnreadMessages(0);
      return;
    }
    try {
      const [threadsResult] = await Promise.all([
        listPublicChatThreads(email, { silent: true, page: 1, limit: 10 }),
      ]);
      const threads = threadsResult.items;
      const threadUnread = threads.reduce(
        (sum, thread) => sum + (thread.unreadForCustomer || 0),
        0,
      );
      // Server unread already includes Platform Support
      setUnreadMessages(threadsResult.unread || threadUnread);
    } catch {
      setUnreadMessages(0);
    }
  }, [authUser?.email]);

  const refreshNotifications = useCallback(async () => {
    if (!authUser?.id && !authUser?.email) {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    try {
      const result = await fetchNotifications({
        page: 1,
        limit: 12,
        status: "all",
        silent: true,
        force: true,
      });
      setNotifications(result.items);
      setUnreadNotifications(result.unreadCount);
    } catch {
      // Keep last known counts if the feed fails.
    }
  }, [authUser?.email, authUser?.id]);

  useEffect(() => {
    void refreshChatBadge();
    void refreshNotifications();
  }, [pathname, refreshChatBadge, refreshNotifications]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (
        type === "CHAT_MESSAGE" ||
        type === "CHAT_THREAD_UPDATED" ||
        type === "CHAT_READ_RECEIPT" ||
        type === "DIRECT_CHAT_MESSAGE" ||
        type === "DIRECT_CHAT_READ"
      ) {
        void refreshChatBadge();
        if (type === "DIRECT_CHAT_READ") {
          void refreshNotifications();
        }
      }
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (mapped) {
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

          setNotifications((current) => {
            if (current.some((row) => row.id === mapped.id)) return current;
            const entry =
              isChatMsg && viewingThisChat
                ? { ...mapped, isRead: true }
                : mapped;
            return [entry, ...current].slice(0, 20);
          });
          if (!mapped.isRead && !(isChatMsg && viewingThisChat)) {
            setUnreadNotifications((count) => count + 1);
          }
        }
        void refreshNotifications();
        void refreshChatBadge();
        return;
      }
      if (type === "ORDER_UPDATED") {
        const payload =
          detail.payload && typeof detail.payload === "object"
            ? (detail.payload as Record<string, unknown>)
            : {};
        const action = String(payload.action || "");
        const number = String(payload.number || "").trim();
        const orderId = String(payload.id || payload.orderId || "").trim();
        let optimistic: AppNotification | null = null;
        if (action === "accept" || action === "auto_confirm") {
          optimistic = {
            id: `booking-accept:${orderId || number || Date.now()}`,
            type: "BOOKING_ACCEPTED",
            title: "Booking accepted",
            message: number
              ? `${number} was accepted by the provider.`
              : "Your booking was accepted.",
            data: { ...payload, href: "/account/dashboard/orders" },
            isRead: false,
            createdAt: new Date().toISOString(),
            href: "/account/dashboard/orders",
          };
        } else if (action === "reject") {
          optimistic = {
            id: `booking-reject:${orderId || number || Date.now()}`,
            type: "BOOKING_REJECTED",
            title: "Booking declined",
            message: number
              ? `${number} was declined by the provider.`
              : "Your booking request was declined.",
            data: { ...payload, href: "/account/dashboard/orders" },
            isRead: false,
            createdAt: new Date().toISOString(),
            href: "/account/dashboard/orders",
          };
        } else if (action === "requested") {
          optimistic = {
            id: `booking-requested:${orderId || number || Date.now()}`,
            type: "ORDER_STATUS_CHANGED",
            title: "Booking request sent",
            message: number
              ? `${number} was sent. Waiting for the provider to accept.`
              : "Your booking request was sent.",
            data: { ...payload, href: "/account/dashboard/orders" },
            isRead: false,
            createdAt: new Date().toISOString(),
            href: "/account/dashboard/orders",
          };
        }
        if (optimistic) {
          const row = optimistic;
          setNotifications((current) => {
            if (current.some((item) => item.id === row.id)) return current;
            return [row, ...current].slice(0, 20);
          });
          setUnreadNotifications((count) => count + 1);
        }
        void refreshNotifications();
        return;
      }
      if (
        type === "CUSTOMER_BADGE_INVALIDATE" ||
        type === "ESTIMATE_SENT" ||
        type === "INVOICE_SENT" ||
        type === "SERVICE_SCHEDULED"
      ) {
        void refreshNotifications();
        if (type === "CUSTOMER_BADGE_INVALIDATE" || type === "SERVICE_SCHEDULED") {
          void refreshChatBadge();
        }
      }
    });
  }, [refreshChatBadge, refreshNotifications]);

  const unreadEstimates = notifications.filter(
    (item) => !item.isRead && /ESTIMATE/i.test(item.type),
  ).length;
  const unreadInvoices = notifications.filter(
    (item) => !item.isRead && /INVOICE/i.test(item.type),
  ).length;
  const unreadOrders = notifications.filter(
    (item) =>
      !item.isRead &&
      (/ORDER/i.test(item.type) || /BOOKING/i.test(item.type) || /WORK_/i.test(item.type)),
  ).length;
  const bellCount = unreadNotifications + unreadMessages;

  async function onOpenNotification(item: AppNotification) {
    const href = notificationHref(item);
    if (!item.isRead) {
      try {
        const result = await markNotificationRead(item.id);
        setUnreadNotifications(result.unreadCount);
        setNotifications((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, isRead: true, readAt: new Date().toISOString() } : row,
          ),
        );
      } catch {
        // still navigate
      }
    }
    router.push(href);
  }

  async function onMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadNotifications(0);
      setNotifications((current) =>
        current.map((row) => ({ ...row, isRead: true, readAt: new Date().toISOString() })),
      );
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-svh bg-[#eef1f5]">
      {/* Sidebar matching Provider Portal style */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#003F7D] text-white transition-[width] duration-200 lg:flex",
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
            unreadInvoices={unreadInvoices}
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
        <header className="sticky top-0 z-20 border-b border-black/10 bg-card">
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
                className="flex w-72 flex-col border-0 bg-[#003F7D] p-0 text-white"
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
                    unreadInvoices={unreadInvoices}
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
                className="h-8 bg-[#f7f8fa] pl-8 text-sm"
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
              <UserAccountMenu user={menuUser} className="size-8 border-black/10" />
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
