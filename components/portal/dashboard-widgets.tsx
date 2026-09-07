"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const DASHBOARD_PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export type DashboardPeriod = "today" | "week" | "month";

export function dashboardGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function inDashboardPeriod(value: string | undefined, period: DashboardPeriod, today = new Date()) {
  if (!value) return false;
  const day = value.slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  if (period === "today") return day === todayKey;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(1);
  const from = start.toISOString().slice(0, 10);
  return day >= from && day <= todayKey;
}

export function StatCell({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card px-5 py-5 transition-colors hover:bg-muted/40"
    >
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </Link>
  );
}

export function BreakdownCard({
  label,
  value,
  href,
  rows,
}: {
  label: string;
  value: string;
  href: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card px-5 py-5 transition-colors hover:bg-muted/40">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

export function AlertCell({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-muted/40"
    >
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

export function BoardCard({
  title,
  href,
  hrefLabel,
  children,
  empty,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  children: ReactNode;
  empty?: string;
}) {
  return (
    <Card className="gap-0 border-border py-0">
      <CardHeader className="border-b border-border bg-muted py-3">
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Link href={href} className="text-sm font-medium text-primary hover:text-primary/80">
            {hrefLabel}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className={cn("divide-y divide-border px-0", empty && "px-(--card-spacing) py-8")}>
        {empty ? <p className="text-center text-sm text-muted-foreground">{empty}</p> : children}
      </CardContent>
    </Card>
  );
}

export function PeriodBar({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (value: DashboardPeriod) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">Your day at a glance — pipeline, money, and work that needs a hand.</p>
      </div>
      <LocalFilterTabs
        value={value}
        onChange={(next) => onChange(next as DashboardPeriod)}
        options={DASHBOARD_PERIODS}
      />
    </div>
  );
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function DateStamp({ value }: { value?: string }) {
  if (!value) {
    return (
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        TBD
      </span>
    );
  }

  const date = new Date(`${value}T00:00:00`);
  return (
    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-primary">
      <span className="text-[9px] font-medium tracking-[0.12em] uppercase">
        {date.toLocaleString("en-US", { month: "short" })}
      </span>
      <span className="text-sm leading-none font-semibold tabular-nums">{date.getDate()}</span>
    </span>
  );
}

export function activityDot(title: string) {
  const label = title.toLowerCase();
  if (label.includes("paid") || label.includes("approved") || label.includes("completed") || label.includes("succeeded")) {
    return "bg-emerald-500";
  }
  if (label.includes("sent") || label.includes("overdue") || label.includes("blocked")) {
    return "bg-amber-400";
  }
  return "bg-primary";
}
