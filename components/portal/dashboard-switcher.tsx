"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardViews } from "@/lib/data/portal-nav";
import { cn } from "@/lib/utils";

export function DashboardSwitcher() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-black/10 bg-card p-0.5">
      {dashboardViews.map((view) => {
        const active = pathname === view.href;
        return (
          <Link
            key={view.href}
            href={view.href}
            className={cn(
              "rounded-sm px-3 py-1.5 text-[13px] font-medium",
              active ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
