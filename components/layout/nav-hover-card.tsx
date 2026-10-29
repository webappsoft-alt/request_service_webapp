"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export type NavHoverRow = { label: string; count: number };

/**
 * Card shown beside a sidebar item on hover: navy header with the item's icon, title and
 * description, then the exact counts behind the badge and the item's sub-pages.
 * Render inside a `<Tooltip>` next to its trigger.
 */
export function NavHoverCardContent({
  title,
  description,
  icon: Icon,
  rows = [],
  subItems = [],
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  rows?: NavHoverRow[];
  subItems?: string[];
}) {
  const hasBody = rows.length > 0 || subItems.length > 0;
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side="right"
        align="start"
        alignOffset={-6}
        sideOffset={14}
        collisionPadding={12}
        className={cn(
          "z-50 w-72 origin-(--radix-tooltip-content-transform-origin) overflow-visible rounded-xl text-left",
          "shadow-[0_22px_44px_-18px_rgba(0,63,125,0.55),0_4px_12px_-4px_rgba(15,23,42,0.12)]",
          "data-[state=delayed-open]:animate-in data-[state=instant-open]:animate-in data-[state=closed]:animate-out",
          "fade-in-0 fade-out-0 slide-in-from-left-1.5 slide-out-to-left-1 zoom-in-[0.98] zoom-out-[0.98] duration-150 ease-out",
        )}
      >
        <div className="overflow-hidden rounded-xl ring-1 ring-[color-mix(in_srgb,var(--nav-card-from,#003F7D)_15%,transparent)] dark:ring-white/10">
          <div className="relative flex items-start gap-3 bg-gradient-to-br from-[var(--nav-card-from,#003F7D)] via-[var(--nav-card-via,#044a92)] to-[var(--nav-card-to,#0b5cad)] px-3.5 py-3 text-white">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full bg-white/10 blur-xl"
            />
            {Icon ? (
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                <Icon className="size-[18px]" aria-hidden />
              </span>
            ) : null}
            <div className="relative min-w-0">
              <p className="text-sm font-semibold tracking-tight">{title}</p>
              {description ? <p className="mt-0.5 text-xs leading-snug text-white/75">{description}</p> : null}
            </div>
          </div>

          {hasBody ? (
            <div className="space-y-2.5 bg-white px-3 py-3 dark:bg-popover">
              {rows.length ? (
                <dl className="space-y-1">
                  {rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-white/5"
                    >
                      <dt className="font-medium text-slate-700 dark:text-foreground">{row.label}</dt>
                      <dd
                        className={cn(
                          "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          row.count > 0
                            ? "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
                            : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-muted-foreground",
                        )}
                      >
                        {row.count > 999 ? "999+" : row.count}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {subItems.length ? (
                <div>
                  <p className="px-0.5 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Includes</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {subItems.map((label) => (
                      <li
                        key={label}
                        className="inline-flex items-center gap-1 rounded-md bg-[#003F7D]/[0.07] px-2 py-1 text-[11px] font-medium text-[#003F7D] dark:bg-primary/15 dark:text-primary"
                      >
                        <ChevronRight className="size-3" aria-hidden />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <TooltipPrimitive.Arrow width={12} height={6} className="fill-[var(--nav-card-from,#003F7D)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
