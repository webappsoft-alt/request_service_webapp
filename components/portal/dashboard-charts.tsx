"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const DASH_CHART_COLORS = [
  "#003F7D",
  "#3d6b9a",
  "#5b8fa8",
  "#8aa8bc",
  "#c5d2dc",
  "#b45309",
];

const DONUT_RING = 2 * Math.PI * 42;

export function DashPanel({
  title,
  href,
  hrefLabel,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-input/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-input/70 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {action
          ? action
          : href && hrefLabel
            ? (
              <Link
                href={href}
                className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                {hrefLabel}
              </Link>
            )
            : null}
      </div>
      <div className={cn("min-h-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function FeedPanel({
  title,
  href,
  hrefLabel,
  empty,
  children,
  className,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  empty?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashPanel
      title={title}
      href={href}
      hrefLabel={hrefLabel}
      className={cn("h-full", className)}
      bodyClassName="p-0"
    >
      <div className="max-h-[20rem] overflow-y-auto">
        {empty ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y divide-input/60">{children}</div>
        )}
      </div>
    </DashPanel>
  );
}

export function MetricTile({
  label,
  value,
  note,
  href,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-lg px-3 py-2.5 transition-colors",
        accent ? "bg-primary/[0.06] hover:bg-primary/[0.1]" : "hover:bg-muted/50",
      )}
    >
      <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums group-hover:text-primary">
        {value}
      </p>
      {note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p> : null}
    </Link>
  );
}

export function StatusBars({
  rows,
  total,
}: {
  rows: { label: string; value: number }[];
  total: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((row, index) => {
        const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const width = Math.max(4, (row.value / max) * 100);
        return (
          <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-foreground">{row.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {row.value}
                  <span className="text-muted-foreground/70"> · {pct}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${width}%`,
                    background: DASH_CHART_COLORS[index % DASH_CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DonutChart({
  rows,
  total,
  centerLabel,
  centerValue,
  size = 128,
}: {
  rows: { label: string; value: number }[];
  total: number;
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  let offset = 0;
  const r = 42;
  const vb = 112;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${vb} ${vb}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={vb / 2}
          cy={vb / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          className="text-muted/80"
        />
        {rows.map((row, index) => {
          const share = total > 0 ? row.value / total : 0;
          if (share <= 0) return null;
          const dash = DONUT_RING * share;
          const node = (
            <circle
              key={row.label}
              cx={vb / 2}
              cy={vb / 2}
              r={r}
              fill="none"
              stroke={DASH_CHART_COLORS[index % DASH_CHART_COLORS.length]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${DONUT_RING - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[9px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {centerLabel}
        </p>
        <p className="text-lg font-semibold tabular-nums leading-none">{centerValue}</p>
      </div>
    </div>
  );
}

export function RevenueBars({
  points,
  formatValue,
}: {
  points: { key: string; label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div
      className="grid h-36 items-end gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
    >
      {points.map((point, index) => {
        const last = index === points.length - 1;
        const ratio = point.value / max;
        const height = point.value > 0 ? Math.max(10, ratio * 112) : 3;
        return (
          <div key={point.key || point.label} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/chart:opacity-100 sm:opacity-100">
              {point.value > 0 ? formatValue(point.value).replace(/\.00$/, "") : ""}
            </span>
            <div
              className={cn(
                "w-full max-w-8 rounded-t-md transition-colors",
                last ? "bg-primary" : "bg-primary/25 hover:bg-primary/40",
              )}
              style={{ height }}
              title={`${point.label}: ${formatValue(point.value)}`}
            />
            <span className="text-[10px] text-muted-foreground">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DualSeriesBars({
  points,
  aKey,
  bKey,
  aLabel,
  bLabel,
}: {
  points: Array<Record<string, string | number>>;
  aKey: string;
  bKey: string;
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(
    ...points.map((p) => Math.max(Number(p[aKey]) || 0, Number(p[bKey]) || 0)),
    1,
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary/25" />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary" />
          {bLabel}
        </span>
      </div>
      <div
        className="grid h-32 items-end gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
      >
        {points.map((point) => {
          const a = Number(point[aKey]) || 0;
          const b = Number(point[bKey]) || 0;
          const label = String(point.label || point.key || "");
          return (
            <div key={String(point.key || label)} className="flex flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center gap-0.5">
                <div
                  className="w-[42%] rounded-t-sm bg-primary/20"
                  style={{ height: `${Math.max(3, (a / max) * 96)}px` }}
                  title={`${aLabel}: ${a}`}
                />
                <div
                  className="w-[42%] rounded-t-sm bg-primary"
                  style={{ height: `${Math.max(3, (b / max) * 96)}px` }}
                  title={`${bLabel}: ${b}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekHeat({
  days,
}: {
  days: Array<{ date: string; label: string; day: number; count: number }>;
}) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const intensity = day.count / max;
        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <div
              className="flex aspect-square w-full items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
              style={{
                background:
                  day.count === 0
                    ? "color-mix(in oklab, var(--muted) 80%, white)"
                    : `color-mix(in oklab, var(--primary) ${Math.round(18 + intensity * 55)}%, white)`,
                color: intensity > 0.55 ? "white" : undefined,
              }}
              title={`${day.label}: ${day.count}`}
            >
              {day.count}
            </div>
            <span className="text-[9px] tracking-wide text-muted-foreground uppercase">
              {day.label.slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
