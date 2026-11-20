"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { peopleSubnav, workSubnav } from "@/lib/data/portal-nav";
import { useAppSelector } from "@/store/hooks";
import { selectPendingReviewTotal } from "@/store/contractorReviewsSlice";
import { cn } from "@/lib/utils";

export function ModuleSubnav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);

  // Phones scroll this row sideways: keep the current section visible (scrolls the row only).
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current=page]");
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: Math.max(0, active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2) });
  }, [pathname]);

  return (
    // Phones: one swipeable row with an inset baseline (not a border) so the active underline
    // still shows inside the scroll box. sm+: the original wrapped row.
    <div
      ref={listRef}
      className="no-scrollbar flex gap-x-5 overflow-x-auto bg-card px-4 shadow-[inset_0_-1px_0_var(--input)] sm:flex-wrap sm:gap-x-6 sm:overflow-visible sm:border-b sm:border-input sm:shadow-none"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors sm:-mb-px",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#003F7D] px-1.5 text-[10px] font-semibold leading-none text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function PeopleSubnav() {
  return <ModuleSubnav items={peopleSubnav} />;
}

export function WorkSubnav() {
  const inbox = usePortalInbox();
  const pendingFieldRequests = useAppSelector(selectPendingReviewTotal);
  return (
    <ModuleSubnav
      items={workSubnav.map((item) => ({
        ...item,
        badge:
          item.href === "/pro/dashboard/requests"
            ? inbox.newLeads
            : item.href === "/pro/dashboard/messages"
              ? inbox.unreadChats
              : item.href === "/pro/dashboard/new-estimate"
                ? inbox.pendingEstimates
                : item.href === "/pro/dashboard/orders"
                  ? inbox.pendingOrders
                  : item.href === "/pro/dashboard/jobs"
                    ? pendingFieldRequests
                    : undefined,
      }))}
    />
  );
}
