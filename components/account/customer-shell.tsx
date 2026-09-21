"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
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
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser, type AuthUser } from "@/store/authSlice";
import { listPublicChatThreads } from "@/lib/api/chat-client";

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
  if (pathname.startsWith(customerPaths.orders)) {
    return { href: customerPaths.orders, label: "Orders" };
  }
  if (pathname.startsWith(customerPaths.requests)) {
    return { href: customerPaths.requests, label: "Requests" };
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
}: {
  collapsed?: boolean;
  closeOnNavigate?: boolean;
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  function badgeFor(href: string) {
    if (href === customerPaths.messages) return unreadMessages;
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
  const [headerSearch, setHeaderSearch] = useState("");

  const menuUser: AuthUser = authUser
    ? { ...authUser, role: authUser.role || "customer" }
    : { role: "customer" };

  const currentSection = getCurrentCustomerSection(pathname);

  useEffect(() => {
    const email = String(authUser?.email || "").trim();
    if (!email) return;
    let cancelled = false;
    void (async () => {
      try {
        const threads = await listPublicChatThreads(email, { silent: true });
        if (cancelled) return;
        setUnreadMessages(
          threads.reduce(
            (sum, thread) => sum + (thread.unreadForCustomer || 0),
            0,
          ),
        );
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.email, pathname]);

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
          <NavLinks collapsed={collapsed} unreadMessages={unreadMessages} />
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
              {currentSection && currentSection.href !== customerPaths.dashboard ? (
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
                    {unreadMessages > 0 ? (
                      <span className="absolute top-1 right-1 flex size-2 rounded-full bg-[#c2410c]" />
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {unreadMessages > 0 ? (
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
