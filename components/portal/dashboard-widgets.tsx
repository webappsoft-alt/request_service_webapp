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
  embedded = false,
  className,
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
  /** Flat tile for use inside a section KPI strip (no outer card chrome). */
  embedded?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block transition-colors hover:bg-muted/40",
        embedded
          ? "px-4 py-3.5"
          : "rounded-xl border border-input bg-card px-5 py-5 shadow-none",
        className,
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          embedded ? "mt-1.5 text-2xl leading-none" : "mt-3 text-[1.75rem] leading-none",
        )}
      >
        {value || 0}
      </p>
      {note ? (
        <p className={cn("text-xs text-muted-foreground", embedded ? "mt-1.5" : "mt-2")}>
          {note}
        </p>
      ) : null}
    </Link>
  );
}

export function BreakdownCard({
  label,
  value,
  href,
  rows,
  embedded = false,
  className,
}: {
  label: string;
  value: string;
  href: string;
  rows: { label: string; value: number }[];
  embedded?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block transition-colors hover:bg-muted/40",
        embedded
          ? "px-4 py-3.5"
          : "rounded-xl border border-input bg-card px-5 py-5 shadow-none",
        className,
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          embedded ? "mt-1.5 text-2xl leading-none" : "mt-3 text-[1.75rem] leading-none",
        )}
      >
        {value}
      </p>
      <dl
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-1 text-xs",
          embedded ? "mt-3" : "mt-4 gap-y-1.5",
        )}
      >
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

/** Divided KPI row inside a DashboardSection — no double card chrome. */
export function KpiStrip({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-background",
        "grid divide-x divide-y divide-input sm:divide-y-0",
        columns === 1 && "grid-cols-1",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type AttentionItem = {
  label: string;
  value: string;
  note?: string;
  href: string;
};

/** Single-panel exceptions bar (Needs attention). */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div
        className={cn(
          "grid divide-y divide-input sm:divide-y-0 sm:divide-x",
          items.length <= 2 && "sm:grid-cols-2",
          items.length === 3 && "sm:grid-cols-3",
          items.length >= 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="px-4 py-3.5 transition-colors hover:bg-muted/40"
          >
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">
              {item.value}
            </p>
            {item.note ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{item.note}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
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
      className="rounded-xl border border-input bg-card px-4 py-4 shadow-none transition-colors hover:bg-muted/40"
    >
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
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
  embedded = false,
  className,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  children: ReactNode;
  empty?: string;
  /** List block inside a DashboardSection (no second outer card). */
  embedded?: boolean;
  className?: string;
}) {
  const header = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-input",
        embedded ? "px-0 pb-2.5" : "px-(--card-spacing) py-3.5",
      )}
    >
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
        {hrefLabel}
      </Link>
    </div>
  );

  const body = (
    <div
      className={cn(
        "max-h-[22rem] overflow-y-auto",
        empty ? "px-1 py-8" : "divide-y divide-input",
        !embedded && empty && "px-(--card-spacing)",
      )}
    >
      {empty ? (
        <p className="text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("flex min-h-0 flex-col gap-0", className)}>
        {header}
        {body}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-xl border border-input bg-card py-0 shadow-none",
        className,
      )}
    >
      <CardHeader className="border-b border-input py-3.5">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        <CardAction>
          <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
            {hrefLabel}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div
          className={cn(
            "max-h-[22rem] overflow-y-auto",
            empty ? "px-(--card-spacing) py-8" : "divide-y divide-input",
          )}
        >
          {empty ? (
            <p className="text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            children
          )}
        </div>
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">Reporting period</p>
      <LocalFilterTabs
        value={value}
        onChange={(next) => onChange(next as DashboardPeriod)}
        options={DASHBOARD_PERIODS}
      />
    </div>
  );
}

/** Groups related dashboard cards under one titled CRM panel. */
export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-input bg-card px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
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

function parseDateStamp(value?: string): Date | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const date = trimmed.includes("T") || trimmed.includes(" ")
    ? new Date(trimmed)
    : new Date(`${dateOnly || trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime()) && dateOnly) {
    const fallback = new Date(`${dateOnly}T00:00:00`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function DateStampFallback() {
  return (
    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      TBD
    </span>
  );
}

export function DateStamp({ value }: { value?: string }) {
  const date = parseDateStamp(value);
  if (!date) return <DateStampFallback />;

  let month = "";
  let day = 0;
  try {
    month = date.toLocaleString("en-US", { month: "short" });
    day = date.getDate();
  } catch {
    return <DateStampFallback />;
  }

  if (!month || Number.isNaN(day)) return <DateStampFallback />;

  return (
    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-primary">
      <span className="text-[9px] font-medium tracking-[0.12em] uppercase">{month}</span>
      <span className="text-sm leading-none font-semibold tabular-nums">{day}</span>
    </span>
  );
}

export function activityDot(title: string) {
  const label = title.toLowerCase();
  if (
    label.includes("paid") ||
    label.includes("approved") ||
    label.includes("completed") ||
    label.includes("succeeded")
  ) {
    return "bg-emerald-500";
  }
  if (label.includes("sent") || label.includes("overdue") || label.includes("blocked")) {
    return "bg-amber-400";
  }
  return "bg-primary";
}
