"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  UserRound,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { TechnicianRealtimeBridge } from "@/components/technician/technician-realtime-bridge";
import { TechnicianGeofenceWatch } from "@/components/time-tracking/geofence-watch";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RouteMapProvider, useRouteOrigin } from "@/components/portal/route-map-provider";
import { useTechChatUnread } from "@/components/tech-chat/use-tech-chat-unread";
import { TechnicianLocationShare } from "@/components/technician/technician-location-share";
import { technicianPaths } from "@/lib/technician-paths";
import type { AppNotification } from "@/lib/api/notifications-client";
import { cn } from "@/lib/utils";
import { NavHoverCardContent } from "@/components/layout/nav-hover-card";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarCollapseToggle } from "@/components/layout/sidebar-collapse-toggle";
import { selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchTechProfile,
  selectTechSectionBadge,
  type TechSection,
} from "@/store/technicianSlice";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** One line shown in the sidebar hover card. */
  description?: string;
  section?: TechSection;
  /** Live unread count from the office chat instead of a section badge. */
  chat?: boolean;
};

const NAV: NavItem[] = [
  { href: technicianPaths.dashboard, label: "Dashboard", icon: LayoutDashboard, description: "Your day at a glance: jobs, visits and hours" },
  { href: technicianPaths.jobs, label: "Jobs", icon: Briefcase, section: "jobs", description: "Jobs assigned to you and their checklists" },
  { href: technicianPaths.estimates, label: "Estimates", icon: FileText, section: "estimates", description: "Estimates and site visits you are working on" },
  { href: technicianPaths.schedule, label: "Schedule", icon: CalendarDays, section: "schedule", description: "Your upcoming visits and job days" },
  { href: technicianPaths.time, label: "Time Tracking", icon: Clock3, description: "Clock in and out and review your hours" },
  { href: technicianPaths.payments, label: "Payments", icon: Wallet, section: "payments", description: "Pay for your hours and jobs" },
  { href: technicianPaths.messages, label: "Messages", icon: MessageSquare, chat: true, description: "Chat with the office" },
  { href: technicianPaths.profile, label: "Profile", icon: UserRound, description: "Your details, skills and password" },
];

function isActive(pathname: string, href: string) {
  if (href === technicianPaths.dashboard) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavBadge({
  section,
  chat = false,
  collapsed = false,
}: {
  section?: TechSection;
  chat?: boolean;
  collapsed?: boolean;
}) {
  const sectionCount = useAppSelector((state) => (section ? selectTechSectionBadge(state, section) : 0));
  const chatCount = useTechChatUnread("technician");
  const count = chat ? chatCount : sectionCount;
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--tech-sidebar-accent)] font-bold leading-none text-[var(--tech-sidebar-2)]",
        collapsed
          ? "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px]"
          : "ml-auto h-[18px] min-w-[18px] px-1.5 text-[10px]",
      )}
      aria-label={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** What each section badge counts, as the row in the hover card. */
const HOVER_ROW_LABELS: Partial<Record<TechSection, string>> = {
  jobs: "New job updates",
  estimates: "New estimate updates",
  schedule: "New schedule updates",
  payments: "New payment updates",
};

/** Sidebar hover card: title, description and the exact count behind the badge. */
function NavItemHoverCard({ item }: { item: NavItem }) {
  const sectionCount = useAppSelector((state) => (item.section ? selectTechSectionBadge(state, item.section) : 0));
  const chatCount = useTechChatUnread("technician");
  const rows = item.chat
    ? [{ label: "Unread messages", count: chatCount }]
    : item.section
      ? [{ label: HOVER_ROW_LABELS[item.section] || "New updates", count: sectionCount }]
      : [];
  return (
    <NavHoverCardContent
      title={item.label}
      description={item.description}
      icon={item.icon as LucideIcon}
      rows={rows}
    />
  );
}

function NavLinks({
  closeOnNavigate = false,
  collapsed = false,
}: {
  closeOnNavigate?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  return (
    <TooltipProvider delayDuration={collapsed ? 0 : 120} skipDelayDuration={400} disableHoverableContent>
      <nav className="flex flex-col gap-0.5" aria-label="Technician portal">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-[var(--tech-sidebar-active)] text-white"
                  : "text-[var(--tech-sidebar-text)] hover:bg-white/5 hover:text-white",
              )}
            >
              {active ? (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--tech-sidebar-accent)]" aria-hidden />
              ) : null}
              <Icon
                className={cn("size-4 shrink-0", active ? "text-[var(--tech-sidebar-accent)]" : "text-slate-400")}
                aria-hidden
              />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
              <NavBadge section={item.section} chat={item.chat} collapsed={collapsed} />
            </Link>
          );
          if (closeOnNavigate) {
            return (
              <span key={item.href} className="contents">
                <SheetClose asChild>{link}</SheetClose>
              </span>
            );
          }
          // Desktop: hover card beside the item (the mobile sheet is touch).
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <NavItemHoverCard item={item} />
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

function SidebarBrand({ company, compact = false }: { company: string; compact?: boolean }) {
  return (
    <Link
      href={technicianPaths.dashboard}
      className="flex items-center gap-2.5"
      aria-label={compact ? company || "Technician portal" : undefined}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--tech-sidebar-accent)] to-[var(--tech-accent)] text-white shadow-sm">
        <Wrench className="size-[18px]" aria-hidden />
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{company || "Technician portal"}</span>
          <span className="block text-[10px] font-semibold tracking-[0.16em] text-[var(--tech-sidebar-accent)] uppercase">
            Technician portal
          </span>
        </span>
      )}
    </Link>
  );
}

function ActiveTimerChip() {
  const active = useAppSelector((state) => state.timeTracking?.active ?? null);
  if (!active) return null;
  const href = active.job
    ? technicianPaths.job(active.job.id)
    : active.estimate
      ? technicianPaths.estimate(active.estimate.id)
      : technicianPaths.time;
  const label = active.job?.number || active.estimate?.number || "Clocked in";
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
      title="You are clocked in"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <LiveTimer entry={active} />
    </Link>
  );
}

/** Header shortcut to the office chat with a live unread badge. */
function TechnicianChatShortcut() {
  const unread = useTechChatUnread("technician");
  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
      <Link href={technicianPaths.messages}>
        <MessageSquare />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

const technicianHref = (item: AppNotification) => {
  const href = item.href || String(item.data?.href || "");
  return href.startsWith("/technical") ? href : technicianPaths.dashboard;
};

function TechnicianNotifications() {
  return <NotificationBell hrefFor={technicianHref} />;
}

import { ThemeToggle } from "@/components/theme/theme-toggle";

function TechnicianAccountMenu() {
  const user = useAppSelector(selectAuthUser);
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Technician";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-1.5 px-1.5" aria-label="Open account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--tech-accent-soft)] text-xs font-semibold text-[var(--tech-accent)]">
            {initials}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {typeof user?.username === "string" && user.username ? `@${user.username}` : "Technician"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={technicianPaths.profile}>
            <UserRound /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={technicianPaths.time}>
            <Clock3 /> Time tracking
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => handleUserLogout()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TechnicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const company = useAppSelector((state) => state.technician.profile.data?.provider?.name || "");
  const businessAddress = useAppSelector((state) => state.technician.profile.data?.provider?.address || "");
  const businessCoords = useAppSelector((state) => state.technician.profile.data?.provider?.coordinates ?? null);
  // Route map starts from the technician's current location; the business is only the fallback.
  const routeOrigin = useRouteOrigin({ businessName: company, businessAddress, businessCoords });
  const profileLoaded = useAppSelector((state) => Boolean(state.technician.profile.data));
  useEffect(() => {
    if (!profileLoaded) void dispatch(fetchTechProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per session
  }, []);

  const title = company || "Technician portal";

  // Dialogs / popovers render in <body>; give them the technician palette too.
  useEffect(() => {
    document.body.classList.add("technician-theme");
    return () => document.body.classList.remove("technician-theme");
  }, []);

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="technician-theme portal-app min-h-svh bg-[var(--tech-bg)]">
      <TechnicianRealtimeBridge />
      <TechnicianGeofenceWatch />
      <TechnicianLocationShare />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-gradient-to-b from-[var(--tech-sidebar)] to-[var(--tech-sidebar-2)] transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-[var(--tech-sidebar-border)]",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <SidebarBrand company={company} compact={collapsed} />
        </div>
        <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          <NavLinks collapsed={collapsed} />
        </div>
        <SidebarCollapseToggle
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
          className="top-4 text-[var(--tech-sidebar)] hover:border-[var(--tech-sidebar)] hover:bg-[var(--tech-sidebar)]"
        />
        {company && !collapsed ? (
          <p className="border-t border-[var(--tech-sidebar-border)] px-4 py-3 text-[11px] leading-snug text-slate-400">
            Working with <span className="font-medium text-slate-200">{company}</span>
          </p>
        ) : null}
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 border-b border-input bg-white/95 dark:bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="technician-theme flex w-72 flex-col border-0 bg-gradient-to-b from-[var(--tech-sidebar)] to-[var(--tech-sidebar-2)] p-0 text-white">
                <SheetHeader className="border-b border-[var(--tech-sidebar-border)] px-4 py-3">
                  <SheetTitle className="sr-only">Technician portal menu</SheetTitle>
                  <SidebarBrand company={company} />
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <NavLinks closeOnNavigate />
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-semibold text-foreground lg:hidden">{title}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <ActiveTimerChip />
              <TechnicianChatShortcut />
              <ThemeToggle />
              <TechnicianNotifications />
              <TechnicianAccountMenu />
            </div>
          </div>
        </header>
        <main key={pathname} id="main-content" className="page-enter px-3 py-3 sm:px-4">
          <div className="mx-auto w-full">
            <RouteMapProvider origin={routeOrigin} currentLocation>
              {children}
            </RouteMapProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
