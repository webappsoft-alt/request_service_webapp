"use client";

import { RouteMapProvider, useRouteOrigin } from "@/components/portal/route-map-provider";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { PeopleSubnav, WorkSubnav } from "@/components/portal/people-subnav";
import { PortalNotifications } from "@/components/portal/portal-notifications";
import { GlobalSearch } from "@/components/portal/global-search";
import { ContractorReviewsBridge } from "@/components/portal/contractor-reviews-bridge";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { useTechChatUnread } from "@/components/tech-chat/use-tech-chat-unread";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isDashboardPath, isPeoplePath, isWorkPath, portalNavGroups } from "@/lib/data/portal-nav";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import { selectPendingReviewTotal } from "@/store/contractorReviewsSlice";
import {
  bumpPortalInboxCount,
  getPortalInboxCounts,
  subscribePortalInboxCounts,
  type PortalInboxCounts,
} from "@/components/portal/portal-inbox-counts-store";
import {
  markNotificationSectionRead,
  type ProviderNotificationSection,
} from "@/lib/api/notifications-client";
import type { AuthUser } from "@/store/authSlice";

function NavLinks({
  collapsed = false,
  closeOnNavigate = false,
}: {
  collapsed?: boolean;
  closeOnNavigate?: boolean;
}) {
  const pathname = usePathname();
  const inbox = usePortalInbox();
  const teamChatUnread = useTechChatUnread("provider");
  const pendingFieldRequests = useAppSelector(selectPendingReviewTotal);
  /** Expanded state of items with nested links (default: open while inside that section). */
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /** Badges that pulse so incoming work is noticed immediately. */
  function pulsesBadge(href: string) {
    return (
      href === "/pro/dashboard/requests" ||
      href === "/pro/dashboard/new-estimate" ||
      href === "/pro/dashboard/jobs" ||
      href === "/pro/dashboard/schedule" ||
      href === "/pro/dashboard/orders"
    );
  }

  function badgeFor(href: string) {
    if (href === "/pro/dashboard/requests") return inbox.newLeads;
    // Customer chats + technician chats share the Messages page.
    if (href === "/pro/dashboard/messages") return inbox.unreadChats + teamChatUnread;
    // Classic estimates nav is hidden; badge follows the new Estimate path.
    // Customer responses (signed / declined / changes requested) — the larger of the two
    // counts, since a change request shows in both.
    if (href === "/pro/dashboard/new-estimate") return Math.max(inbox.pendingEstimates, inbox.estimateUpdates);
    // New booking requests + other order updates (status, dispute, payment released).
    if (href === "/pro/dashboard/orders") return inbox.pendingOrders + inbox.orderUpdates;
    // Completion proofs / change order requests from the field + answered change orders.
    if (href === "/pro/dashboard/jobs") return pendingFieldRequests + inbox.jobUpdates;
    // Visits booked (e.g. by the AI receptionist).
    if (href === "/pro/dashboard/schedule") return inbox.scheduleUpdates;
    return 0;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col gap-4" aria-label="Portal">
        {portalNavGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label && !collapsed ? (
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/pro/dashboard"
                  ? isDashboardPath(pathname)
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                    "relative flex items-center gap-2.5 rounded-md py-1.5 text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="size-4" aria-hidden="true" />
                    {collapsed && count > 0 ? (
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold leading-none text-[#003F7D]",
                          pulsesBadge(item.href) && "animate-pulse ring-2 ring-amber-300",
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </span>
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  {!collapsed && count > 0 ? (
                    <span
                      className={cn(
                        "ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold leading-none text-[#003F7D]",
                        pulsesBadge(item.href) &&
                          "animate-pulse ring-2 ring-amber-300 ring-offset-1 ring-offset-[#003F7D]",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              );

              if (!collapsed) {
                const wrapped = closeOnNavigate ? <SheetClose asChild>{link}</SheetClose> : link;
                if (!item.children?.length) {
                  return (
                    <span key={item.href} className="contents">
                      {wrapped}
                    </span>
                  );
                }
                const inSection = item.children.some((child) => matches(child.href));
                const open = openParents[item.href] ?? inSection;
                // Parent with nested links: the whole row is a dropdown toggle; only the children navigate.
                return (
                  <div key={item.href} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setOpenParents((prev) => ({ ...prev, [item.href]: !open }))}
                      aria-expanded={open}
                      className={cn(
                        "relative flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13px] font-medium transition-colors",
                        inSection && !open ? "bg-white/15 text-white" : inSection ? "text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold leading-none text-[#003F7D]",
                            pulsesBadge(item.href) && "animate-pulse ring-2 ring-amber-300 ring-offset-1 ring-offset-[#003F7D]",
                          )}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn("size-3.5 shrink-0 text-white/60 transition-transform duration-200", open && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                    {open ? (
                      <div className="mt-0.5 mb-1 ml-[1.45rem] flex flex-col gap-0.5 border-l border-white/20 pl-2.5">
                        {item.children.map((child) => {
                          const childActive = matches(child.href);
                          const childLink = (
                            <Link
                              href={child.href}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "rounded-md px-3 py-1.5 text-[12.5px] transition-colors",
                                childActive ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                              )}
                            >
                              {child.label}
                            </Link>
                          );
                          return (
                            <span key={child.href} className="contents">
                              {closeOnNavigate ? <SheetClose asChild>{childLink}</SheetClose> : childLink}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
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

/** Sidebar sections whose badge counts unread notifications, and the count each one clears. */
const NOTIFICATION_SECTIONS: Array<{
  href: string;
  section: ProviderNotificationSection;
  count: keyof PortalInboxCounts;
}> = [
  { href: "/pro/dashboard/new-estimate", section: "estimates", count: "estimateUpdates" },
  { href: "/pro/dashboard/jobs", section: "jobs", count: "jobUpdates" },
  { href: "/pro/dashboard/schedule", section: "schedule", count: "scheduleUpdates" },
  { href: "/pro/dashboard/orders", section: "orders", count: "orderUpdates" },
];

/**
 * Opening Estimate / Jobs / Schedules / Fixed service orders reads that section's updates,
 * so its badge clears (and the bell drops by the same amount, in every tab).
 */
function useReadSectionOnOpen(pathname: string) {
  // Read the shared counts store directly (usePortalInbox would add another socket listener).
  const [counts, setCounts] = useState(getPortalInboxCounts);
  useEffect(() => subscribePortalInboxCounts(() => setCounts(getPortalInboxCounts())), []);
  const inFlight = useRef(false);
  const match = NOTIFICATION_SECTIONS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pending = match ? counts[match.count] : 0;

  useEffect(() => {
    // On the section with something to clear — including updates that arrive while it is open.
    if (!match || !pending || inFlight.current) return;
    inFlight.current = true;
    bumpPortalInboxCount(match.count, -pending);
    void markNotificationSectionRead(match.section)
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, [match, pending]);
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useReadSectionOnOpen(pathname);
  const router = useRouter();
  const { provider, session } = usePortalWorkspace();
  const routeOrigin = useRouteOrigin({ provider, businessName: provider?.companyName });
  const authUser = useAppSelector(selectAuthUser);
  const { records, closeRecord } = useOpenRecords();
  const [collapsed, setCollapsed] = useState(false);
  const showPeople = isPeoplePath(pathname);
  const showWork = isWorkPath(pathname);

  const menuUser: AuthUser = authUser
    ? { ...authUser, role: authUser.role || "provider" }
    : {
        role: "provider",
        firstName: session?.firstName,
        lastName: session?.lastName,
        email: session?.email,
      };

  return (
    <div className="portal-app min-h-svh bg-[#eef1f5] dark:bg-background">
      <ContractorReviewsBridge />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col print:hidden! bg-[#003F7D] dark:bg-slate-900 dark:border-r dark:border-border text-white transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className={cn("flex h-12 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <Link href="/pro/dashboard" className="truncate text-sm font-semibold tracking-wide">
              RS
            </Link>
          ) : (
            <div className="flex min-w-0 flex-col leading-tight">
              <Link href="/pro/dashboard" className="truncate text-sm font-semibold tracking-wide">
                {provider.companyName}
              </Link>
              <span className="mt-0.5 truncate text-[11px] text-white/65">Request Service</span>
            </div>
          )}
        </div>
        <div className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-2")}>
          <NavLinks collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="border-t border-white/10 px-3 py-3 text-left text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? "Show" : "Hide labels"}
        </button>
      </aside>

      <div className={cn("transition-[padding] duration-200 print:pl-0!", collapsed ? "lg:pl-16" : "lg:pl-56")}>
        <header className="sticky top-0 z-20 border-b border-input bg-card print:hidden">
          <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open portal menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-0 bg-[#003F7D] dark:bg-slate-900 dark:border-r dark:border-border p-0 text-white">
                <SheetHeader className="border-b border-white/10 px-4 py-3">
                  <SheetTitle className="text-white">{provider.companyName}</SheetTitle>
                  <p className="text-xs text-white/65">Request Service</p>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                  <NavLinks closeOnNavigate />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto md:flex">
              <RecordTab href="/pro/dashboard" label={provider.companyName} active={isDashboardPath(pathname)} />
              {records.map((record) => (
                <RecordTab
                  key={record.href}
                  href={record.href}
                  label={record.label}
                  active={pathname === record.href || pathname.startsWith(`${record.href}?`)}
                  onClose={() => {
                    closeRecord(record.href);
                    if (pathname === record.href) router.push("/pro/dashboard/customers");
                  }}
                />
              ))}
            </div>

            <GlobalSearch className="ml-auto hidden w-[22rem] lg:block xl:w-[26rem]" />
            <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
              <ThemeToggle />
              <PortalNotifications />
              <UserAccountMenu user={menuUser} className="size-8 border-input" />
            </div>
          </div>
          {showPeople ? <PeopleSubnav /> : null}
          {showWork ? <WorkSubnav /> : null}
        </header>
        <main key={pathname} id="main-content" className="page-enter px-3 py-3 sm:px-4">
          <div className="mx-auto w-full">
            <RouteMapProvider origin={routeOrigin}>{children}</RouteMapProvider>
          </div>
        </main>
      </div>
    </div>
  );
}

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
        className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-[#003F7D] dark:bg-primary" : "bg-black/25 dark:bg-white/30")}
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
