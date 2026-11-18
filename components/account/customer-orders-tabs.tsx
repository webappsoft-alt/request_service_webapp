"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { customerPaths } from "@/lib/customer-paths";
import { cn } from "@/lib/utils";

/**
 * "All orders | Change orders" switch in the Orders page header. The sidebar shows one Orders
 * link (client: less clutter), so change orders are reached from here instead of a dropdown.
 */
export function CustomerOrdersTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: customerPaths.orders, label: "All orders" },
    { href: customerPaths.changeOrders, label: "Change orders" },
  ];
  return (
    <nav aria-label="Orders sections" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
