"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  FileText,
  Inbox,
  Receipt,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  DashboardActionCenter,
  DashboardActionItem,
} from "@/store/dashboardSlice";

const KIND_ICON: Record<string, typeof Inbox> = {
  lead: Inbox,
  estimate: FileText,
  job: Briefcase,
  invoice: Receipt,
  change_order: FilePlus2,
  task: ClipboardList,
  reminder: Bell,
  schedule: CalendarClock,
};

type Priority = "high" | "medium" | "low";

/** Rail / chip colours per priority. Only `high` animates. */
const PRIORITY_STYLE: Record<Priority, { rail: string; chip: string; icon: string; label: string }> = {
  high: {
    rail: "bg-red-500",
    chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
    icon: "bg-red-50 text-red-600",
    label: "Urgent",
  },
  medium: {
    rail: "bg-amber-400",
    chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    icon: "bg-amber-50 text-amber-700",
    label: "Soon",
  },
  low: {
    rail: "bg-slate-300",
    chip: "bg-slate-100 text-slate-600",
    icon: "bg-slate-100 text-slate-600",
    label: "Watch",
  },
};

const ACTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "lead", label: "Leads" },
  { id: "estimate", label: "Estimates" },
  { id: "job", label: "Jobs" },
  { id: "invoice", label: "Invoices" },
] as const;

type ActionFilter = (typeof ACTION_FILTERS)[number]["id"];

function matchesFilter(item: DashboardActionItem, filter: ActionFilter) {
  if (filter === "all") return true;
  if (filter === "job") return item.kind === "job" || item.kind === "change_order";
  return item.kind === filter;
}

function subline(item: DashboardActionItem) {
  return [item.customerName, item.title ? item.reference : "", item.detail]
    .filter(Boolean)
    .join(" · ");
}

/** Important action — a task card with a priority rail and a primary CTA. */
function ActionCard({ item }: { item: DashboardActionItem }) {
  const Icon = KIND_ICON[item.kind] ?? CalendarClock;
  const priority: Priority = item.priority ?? "low";
  const style = PRIORITY_STYLE[priority];
  const urgent = priority === "high";
  const heading = item.title || item.reference || item.actionLabel;
  const detail = subline(item);

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group relative flex items-center gap-3 overflow-hidden rounded-lg border bg-card py-2.5 pr-3 pl-4 transition-all",
          "hover:-translate-y-px hover:shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)]",
          urgent ? "border-red-200 bg-red-50/40" : "border-input/80",
        )}
      >
        <span
          className={cn("absolute inset-y-0 left-0 w-1", style.rail, urgent && "action-urgent-rail")}
          aria-hidden
        />
        <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full", style.icon)}>
          {urgent ? <span className="action-urgent-ping" aria-hidden /> : null}
          <Icon className="relative size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase",
                style.chip,
              )}
            >
              {urgent ? <span className="action-urgent-blink size-1.5 rounded-full bg-red-500" aria-hidden /> : null}
              {style.label}
            </span>
            <span className="truncate text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {item.actionLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{heading}</p>
          {detail ? <p className="truncate text-[11px] text-muted-foreground">{detail}</p> : null}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          {item.statusLabel ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {item.statusLabel}
            </span>
          ) : null}
          {item.amount ? (
            <span className="text-[11px] font-semibold tabular-nums text-foreground">{formatMoney(item.amount)}</span>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-colors",
            "bg-[#003F7D] text-white group-hover:bg-[#002f5e]",
          )}
        >
          {urgent ? "Act now" : "Open"}
          <ArrowRight className="size-3" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

/** Today's work — calm timeline card, no animation. */
function TodayCard({ item }: { item: DashboardActionItem }) {
  const Icon = KIND_ICON[item.kind] ?? CalendarClock;
  const heading = item.title || item.reference || item.actionLabel;
  const detail = subline(item);

  return (
    <li>
      <Link
        href={item.href}
        className="group flex items-center gap-3 rounded-lg border border-[#003F7D]/15 bg-[#f6f9fc] px-3 py-2.5 transition-colors hover:border-[#003F7D]/35 hover:bg-[#eef3f9]"
      >
        <span className="flex w-16 shrink-0 flex-col items-center rounded-md bg-white py-1 text-center ring-1 ring-[#003F7D]/15">
          <span className="text-[11px] font-bold tabular-nums text-[#003F7D]">{item.time || "Today"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-[#003F7D]/70 uppercase">
            <Icon className="size-3" aria-hidden />
            {item.actionLabel}
          </p>
          <p className="truncate text-[13px] font-semibold text-foreground">{heading}</p>
          {detail ? <p className="truncate text-[11px] text-muted-foreground">{detail}</p> : null}
        </div>
        {item.statusLabel ? (
          <span className="hidden shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-input sm:inline">
            {item.statusLabel}
          </span>
        ) : null}
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#003F7D]/25 bg-white px-2.5 text-[11px] font-semibold text-[#003F7D] group-hover:border-[#003F7D]/50">
          Start
          <ArrowRight className="size-3" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

function Panel({
  tone,
  icon,
  title,
  meta,
  children,
  className,
}: {
  tone: "urgent" | "today";
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        tone === "urgent" ? "border-red-200" : "border-[#003F7D]/20",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2.5",
          tone === "urgent"
            ? "border-b border-red-200 bg-gradient-to-r from-red-50 via-white to-white"
            : "bg-[#003F7D] text-white",
        )}
      >
        <h2
          className={cn(
            "flex items-center gap-2 text-[13px] font-semibold tracking-tight",
            tone === "urgent" ? "text-red-800" : "text-white",
          )}
        >
          {icon}
          {title}
        </h2>
        {meta}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function LoadingCards() {
  return (
    <ul className="space-y-2 p-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 rounded-lg border border-input/60 px-3 py-3">
          <span className="size-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-24 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Important Actions + Today's Work — quick navigation into existing detail
 * pages. Data comes from the provider dashboard payload (`actionCenter`).
 * Each panel only renders when it has items; a lone panel takes full width,
 * and the block disappears when there is nothing to act on.
 */
export function DashboardActionCenter({
  actionCenter,
  loading,
  error,
}: {
  actionCenter: DashboardActionCenter | null | undefined;
  loading: boolean;
  error?: string | null;
}) {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const actions = actionCenter?.importantActions ?? [];
  const today = actionCenter?.today ?? [];
  const visibleActions = actions.filter((item) => matchesFilter(item, filter));
  const showLoading = loading && !actionCenter;
  const failed = Boolean(error) && !actionCenter;

  if (showLoading) {
    return (
      <div className="grid gap-3 xl:grid-cols-12">
        <Panel tone="urgent" icon={<AlertTriangle className="size-4" aria-hidden />} title="Important actions" className="xl:col-span-7">
          <LoadingCards />
        </Panel>
        <Panel tone="today" icon={<CalendarClock className="size-4" aria-hidden />} title="Today's work" className="xl:col-span-5">
          <LoadingCards />
        </Panel>
      </div>
    );
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-input/80 bg-card px-4 py-3 text-xs text-muted-foreground">
        Could not load actions and today&apos;s work. Refresh to try again.
      </p>
    );
  }

  const hasActions = actions.length > 0;
  const hasToday = today.length > 0;
  if (!hasActions && !hasToday) return null;
  const both = hasActions && hasToday;
  const filters = ACTION_FILTERS.filter(
    (option) => option.id === "all" || actions.some((item) => matchesFilter(item, option.id)),
  );
  const urgentCount = actionCenter?.importantActionsHigh ?? 0;

  return (
    <div className="grid gap-3 xl:grid-cols-12">
      {hasActions ? (
        <Panel
          tone="urgent"
          icon={
            <span className="relative flex size-5 items-center justify-center">
              {urgentCount > 0 ? <span className="action-urgent-ping" aria-hidden /> : null}
              <AlertTriangle className="relative size-4" aria-hidden />
            </span>
          }
          title="Important actions"
          className={both ? "xl:col-span-7" : "xl:col-span-12"}
          meta={
            <p className="text-[11px] text-muted-foreground">
              {urgentCount > 0 ? (
                <span className="font-semibold text-red-700">{urgentCount} urgent</span>
              ) : (
                "Nothing urgent"
              )}
              {" · "}
              {actionCenter?.importantActionsTotal ?? actions.length} pending
            </p>
          }
        >
          {filters.length > 2 ? (
            <div className="flex flex-wrap gap-1 border-b border-input/60 px-4 py-2">
              {filters.map((option) => {
                const count = actions.filter((item) => matchesFilter(item, option.id)).length;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    aria-pressed={filter === option.id}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      filter === option.id
                        ? "bg-[#003F7D] text-white"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label}
                    <span className="ml-1 opacity-75">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {visibleActions.length ? (
            <ul
              className={cn(
                "grid max-h-[24rem] gap-2 overflow-y-auto p-3",
                !both && "lg:grid-cols-2",
              )}
            >
              {visibleActions.map((item) => (
                <ActionCard key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nothing in this filter.</p>
          )}
        </Panel>
      ) : null}

      {hasToday ? (
        <Panel
          tone="today"
          icon={<CalendarClock className="size-4" aria-hidden />}
          title="Today's work"
          className={both ? "xl:col-span-5" : "xl:col-span-12"}
          meta={
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {today.length} today
              </span>
              <Link href="/pro/dashboard/schedule" className="text-[11px] font-medium text-white/85 hover:text-white">
                Open schedule
              </Link>
            </div>
          }
        >
          <ul
            className={cn(
              "grid max-h-[26.5rem] gap-2 overflow-y-auto p-3",
              !both && "lg:grid-cols-2",
            )}
          >
            {today.map((item) => (
              <TodayCard key={item.id} item={item} />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
