"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  FilePlus2,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  UserRound,
  Wallet,
} from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { ContractorRealtimeBridge } from "@/components/contractor/contractor-realtime-bridge";
import { ContractorGeofenceWatch } from "@/components/time-tracking/geofence-watch";
import { RouteMapProvider, useRouteOrigin } from "@/components/portal/route-map-provider";
import { useTechChatUnread } from "@/components/tech-chat/use-tech-chat-unread";
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
import type { ContractorSection } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import type { AppNotification } from "@/lib/api/notifications-client";
import { cn } from "@/lib/utils";
import { selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchContractorProfile,
  selectContractorSectionBadge,
} from "@/store/contractorPortalSlice";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: ContractorSection;
  /** Badge from unread office messages instead of a section counter. */
  chat?: boolean;
};

const NAV: NavItem[] = [
  { href: contractorPaths.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: contractorPaths.jobs, label: "Assigned Jobs", icon: Briefcase, section: "jobs" },
  { href: contractorPaths.schedule, label: "Schedule", icon: CalendarDays },
  { href: contractorPaths.messages, label: "Messages", icon: MessageSquare, chat: true },
  { href: contractorPaths.changeRequests, label: "Change Requests", icon: FilePlus2, section: "changeRequests" },
  { href: contractorPaths.payouts, label: "Invoices / Payouts", icon: Wallet, section: "payouts" },
  { href: contractorPaths.profile, label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === contractorPaths.dashboard) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Live sidebar counter — new office feedback since the section was last opened. */
function NavBadge({ section, chat }: { section?: ContractorSection; chat?: boolean }) {
  const sectionCount = useAppSelector((state) => (section ? selectContractorSectionBadge(state, section) : 0));
  const chatCount = useTechChatUnread("technician");
  const count = chat ? chatCount : sectionCount;
  if (!count) return null;
  return (
    <span
      className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--ct-sidebar-accent)] px-1.5 text-[10px] font-bold leading-none text-[var(--ct-sidebar-2)]"
      aria-label={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLinks({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Contractor portal">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const link = (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-[var(--ct-sidebar-active)] text-white"
                : "text-[var(--ct-sidebar-text)] hover:bg-white/5 hover:text-white",
            )}
          >
            {active ? (
              <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--ct-sidebar-accent)]" aria-hidden />
            ) : null}
            <Icon
              className={cn("size-4 shrink-0", active ? "text-[var(--ct-sidebar-accent)]" : "text-slate-400")}
              aria-hidden
            />
            {item.label}
            <NavBadge section={item.section} chat={item.chat} />
          </Link>
        );
        return (
          <span key={item.href} className="contents">
            {closeOnNavigate ? <SheetClose asChild>{link}</SheetClose> : link}
          </span>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ company }: { company: string }) {
  return (
    <Link href={contractorPaths.dashboard} className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--ct-sidebar-accent)] to-[var(--ct-accent)] text-white shadow-sm">
        <HardHat className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{company || "Contractor portal"}</span>
        <span className="block text-[10px] font-semibold tracking-[0.16em] text-[var(--ct-sidebar-accent)] uppercase">
          Contractor portal
        </span>
      </span>
    </Link>
  );
}

const contractorHref = (item: AppNotification) => {
  const href = item.href || String(item.data?.href || "");
  return href.startsWith("/contractor") ? href : contractorPaths.dashboard;
};

function ContractorNotifications() {
  return <NotificationBell hrefFor={contractorHref} />;
}

import { ThemeToggle } from "@/components/theme/theme-toggle";

function ContractorAccountMenu() {
  const user = useAppSelector(selectAuthUser);
  const profile = useAppSelector((state) => state.contractorPortal.profile.data);
  const name = profile?.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Contractor";
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
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--ct-accent-soft)] text-xs font-semibold text-[var(--ct-accent)]">
            {initials}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[profile?.trade, profile?.number].filter(Boolean).join(" · ") || user?.email || "Contractor"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={contractorPaths.profile}>
            <UserRound /> Profile
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

export function ContractorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const company = useAppSelector((state) => state.contractorPortal.profile.data?.provider?.name || "");
  const profileLoaded = useAppSelector((state) => Boolean(state.contractorPortal.profile.data));
  // Same route map as the technician portal: from where the contractor is now to the site.
  const routeOrigin = useRouteOrigin({ businessName: company || "Office" });

  // Dialogs, menus and sheets portal to <body>; give them the contractor palette too.
  useEffect(() => {
    document.body.classList.add("contractor-theme");
    return () => document.body.classList.remove("contractor-theme");
  }, []);

  useEffect(() => {
    if (!profileLoaded) void dispatch(fetchContractorProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per session
  }, []);

  return (
    <div className="contractor-theme portal-app min-h-svh bg-[var(--ct-bg)]">
      <ContractorRealtimeBridge />
      <ContractorGeofenceWatch />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-gradient-to-b from-[var(--ct-sidebar)] to-[var(--ct-sidebar-2)] lg:flex">
        <div className="flex h-14 items-center border-b border-[var(--ct-sidebar-border)] px-4">
          <SidebarBrand company={company} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </div>
        {company ? (
          <p className="border-t border-[var(--ct-sidebar-border)] px-4 py-3 text-[11px] leading-snug text-slate-400">
            Working with <span className="font-medium text-slate-200">{company}</span>
          </p>
        ) : null}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-input bg-white/95 dark:bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="contractor-theme flex w-72 flex-col border-0 bg-gradient-to-b from-[var(--ct-sidebar)] to-[var(--ct-sidebar-2)] p-0 text-white"
              >
                <SheetHeader className="border-b border-[var(--ct-sidebar-border)] px-4 py-3">
                  <SheetTitle className="sr-only">Contractor portal menu</SheetTitle>
                  <SidebarBrand company={company} />
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <NavLinks closeOnNavigate />
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-semibold text-foreground lg:hidden">{company || "Contractor portal"}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <ContractorNotifications />
              <ContractorAccountMenu />
            </div>
          </div>
        </header>
        <main key={pathname} id="main-content" className="page-enter px-3 py-4 sm:px-5">
          <div className="mx-auto w-full max-w-7xl">
            <RouteMapProvider origin={routeOrigin} currentLocation>
              {children}
            </RouteMapProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
