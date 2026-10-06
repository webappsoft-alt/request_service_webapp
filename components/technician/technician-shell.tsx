"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Wallet,
} from "lucide-react";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { TechnicianRealtimeBridge } from "@/components/technician/technician-realtime-bridge";
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
import { technicianPaths } from "@/lib/technician-paths";
import { cn } from "@/lib/utils";
import { selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchTechProfile,
  markAllTechNotificationsRead,
  markTechNotificationRead,
  selectTechSectionBadge,
  type TechSection,
} from "@/store/technicianSlice";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: TechSection;
};

const NAV: NavItem[] = [
  { href: technicianPaths.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: technicianPaths.jobs, label: "Jobs", icon: Briefcase, section: "jobs" },
  { href: technicianPaths.estimates, label: "Estimates", icon: FileText, section: "estimates" },
  { href: technicianPaths.schedule, label: "Schedule", icon: CalendarDays, section: "schedule" },
  { href: technicianPaths.time, label: "Time Tracking", icon: Clock3 },
  { href: technicianPaths.payments, label: "Payments", icon: Wallet, section: "payments" },
  { href: technicianPaths.profile, label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === technicianPaths.dashboard) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavBadge({ section }: { section?: TechSection }) {
  const count = useAppSelector((state) => (section ? selectTechSectionBadge(state, section) : 0));
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold leading-none text-[#003F7D]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLinks({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Technician portal">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const link = (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
            <NavBadge section={item.section} />
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

function TechnicianNotifications() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notifications = useAppSelector((state) => state.technician.notifications);
  const unread = Math.max(
    notifications.unread,
    notifications.items.filter((item) => !item.isRead).length,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2">
          <span>Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:underline"
              onClick={() => void dispatch(markAllTechNotificationsRead())}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {notifications.items.length ? (
            notifications.items.slice(0, 30).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2"
                onSelect={() => {
                  if (!item.isRead) void dispatch(markTechNotificationRead(item.id));
                  const href = item.href || String(item.data?.href || "");
                  router.push(href.startsWith("/technical") ? href : technicianPaths.dashboard);
                }}
              >
                <span className={cn("text-sm font-medium", item.isRead ? "text-muted-foreground" : "text-foreground")}>
                  {item.title}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.message}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {notifications.loading ? "Loading…" : "You're all caught up."}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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

  return (
    <div className="portal-app min-h-svh bg-[#eef1f5]">
      <TechnicianRealtimeBridge />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-[#003F7D] text-white lg:flex">
        <div className="flex h-12 flex-col justify-center border-b border-white/10 px-4">
          <Link href={technicianPaths.dashboard} className="truncate text-sm font-semibold tracking-wide">
            {title}
          </Link>
          <span className="text-[10px] font-semibold tracking-[0.16em] text-white/50 uppercase">Technician</span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavLinks />
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 border-b border-input bg-card">
          <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-0 bg-[#003F7D] p-0 text-white">
                <SheetHeader className="border-b border-white/10 px-4 py-3">
                  <SheetTitle className="text-white">{title}</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                  <NavLinks closeOnNavigate />
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-semibold text-foreground lg:hidden">{title}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <ActiveTimerChip />
              <TechnicianNotifications />
              <TechnicianAccountMenu />
            </div>
          </div>
        </header>
        <main key={pathname} id="main-content" className="page-enter px-3 py-3 sm:px-4">
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
