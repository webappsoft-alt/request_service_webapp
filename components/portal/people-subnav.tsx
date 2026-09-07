"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { peopleSubnav, workSubnav } from "@/lib/data/portal-nav";
import { cn } from "@/lib/utils";

export function ModuleSubnav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-x-5 border-b border-black/10 bg-card px-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="rounded-full bg-[#003F7D] px-1.5 text-[10px] font-semibold text-white">{item.badge}</span>
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
  return (
    <ModuleSubnav
      items={workSubnav.map((item) => ({
        ...item,
        badge:
          item.href === "/pro/dashboard/requests"
            ? inbox.newLeads
            : item.href === "/pro/dashboard/messages"
              ? inbox.unreadChats
              : undefined,
      }))}
    />
  );
}
