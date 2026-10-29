"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Round open/close button that sits on the sidebar's right edge near the top (half over the
 * sidebar, half over the page). Place it inside the fixed `<aside>`.
 */
export function SidebarCollapseToggle({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Vertical position, e.g. `top-3` to centre on a 48px header row. */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "absolute -right-3 z-40 flex size-6 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#003F7D] shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition hover:scale-105 hover:border-[#003F7D] hover:bg-[#003F7D] hover:text-white focus-visible:ring-2 focus-visible:ring-[#003F7D]/40 focus-visible:outline-none active:scale-95 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-primary dark:hover:text-primary-foreground print:hidden",
        className,
      )}
    >
      <ChevronLeft
        className={cn("size-3.5 transition-transform duration-200", collapsed && "rotate-180")}
        aria-hidden
      />
    </button>
  );
}
