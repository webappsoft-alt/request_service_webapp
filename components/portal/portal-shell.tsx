"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HelpCircle, Menu, Search, Settings, X } from "lucide-react";
import { PeopleSubnav, WorkSubnav } from "@/components/portal/people-subnav";
import { PortalNotifications } from "@/components/portal/portal-notifications";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function NavLinks({
  collapsed = false,
  closeOnNavigate = false,
}: {
  collapsed?: boolean;
  closeOnNavigate?: boolean;
}) {
  const pathname = usePathname();
  const inbox = usePortalInbox();

  function badgeFor(href: string) {
    if (href === "/pro/dashboard/requests") return inbox.newLeads;
    if (href === "/pro/dashboard/messages") return inbox.unreadChats;
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
              const link = (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  {!collapsed && badgeFor(item.href) ? (
                    <span className="ml-auto rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
                      {badgeFor(item.href)}
                    </span>
                  ) : null}
                </Link>
              );

              if (!collapsed) {
                return (
                  <span key={item.href} className="contents">
                    {closeOnNavigate ? <SheetClose asChild>{link}</SheetClose> : link}
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

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { provider, session, signOut } = usePortalWorkspace();
  const { records, closeRecord } = useOpenRecords();
  const [collapsed, setCollapsed] = useState(false);
  const showPeople = isPeoplePath(pathname);
  const showWork = isWorkPath(pathname);

  return (
    <div className="min-h-svh bg-[#eef1f5]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#003F7D] text-white transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className={cn("flex h-12 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-4")}>
          <Link href="/pro/dashboard" className="truncate text-sm font-semibold tracking-wide">
            {collapsed ? "RS" : provider.companyName}
          </Link>
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

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-56")}>
        <header className="sticky top-0 z-20 border-b border-black/10 bg-card">
          <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open portal menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-0 bg-[#003F7D] p-0 text-white">
                <SheetHeader className="border-b border-white/10 px-4 py-3">
                  <SheetTitle className="text-white">{provider.companyName}</SheetTitle>
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

            <div className="relative ml-auto hidden w-56 lg:block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search records…" className="h-8 bg-[#f7f8fa] pl-8 text-sm" aria-label="Search records" />
            </div>
            <PortalNotifications />
            <Button asChild variant="ghost" size="icon" aria-label="Settings">
              <Link href="/pro/dashboard/settings">
                <Settings />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Help">
              <HelpCircle />
            </Button>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/pro/login");
              }}
              className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:inline"
            >
              {session?.firstName ?? "Account"}
            </button>
          </div>
          {showPeople ? <PeopleSubnav /> : null}
          {showWork ? <WorkSubnav /> : null}
        </header>
        <main key={pathname} id="main-content" className="page-enter px-3 py-3 sm:px-4">
          <div className="mx-auto w-full">{children}</div>
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
        "flex h-8 max-w-52 shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 text-xs",
        active
          ? "border-[#003F7D]/25 bg-[#e8eef5] font-semibold text-[#003F7D] shadow-[inset_0_-2px_0_#003F7D]"
          : "border-black/10 bg-[#f7f8fa] text-muted-foreground hover:border-black/20 hover:bg-white hover:text-foreground",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-[#003F7D]" : "bg-black/25")}
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
