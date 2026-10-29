"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Staggered fade/slide-in for dashboard blocks (index × 70ms). */
export function enterStyle(index: number): CSSProperties {
  return { animationDelay: `${index * 70}ms` };
}
export const ENTER_CLASS = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500";

/** True one frame after mount, so bar/donut widths can animate from zero. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

const TONES = {
  primary: { tile: "bg-primary/10 text-primary", bar: "bg-primary" },
  sky: { tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
  emerald: { tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  amber: { tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  violet: { tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
} as const;
export type MetricTone = keyof typeof TONES;

/** Summary card: icon, big number, note and a slim progress bar (active share of the total). */
export function MetricCard({
  label,
  value,
  note,
  href,
  icon: Icon,
  tone,
  progress,
  loading,
  index = 0,
}: {
  label: string;
  value: number;
  note: string;
  href: string;
  icon: LucideIcon;
  tone: MetricTone;
  /** 0–1; omitted hides the bar. */
  progress?: number;
  loading?: boolean;
  index?: number;
}) {
  const mounted = useMounted();
  const colors = TONES[tone];
  return (
    <Link
      href={href}
      style={enterStyle(index)}
      className={cn(
        ENTER_CLASS,
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border-card bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", colors.tile)}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
          {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-muted align-middle" /> : value}
        </p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{note}</p>
      </div>
      {progress !== undefined ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", colors.bar)}
            style={{ width: mounted ? `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` : "0%" }}
          />
        </div>
      ) : null}
    </Link>
  );
}

function ChartCard({ title, subtitle, href, index, children }: { title: string; subtitle: string; href: string; index: number; children: ReactNode }) {
  return (
    <section style={enterStyle(index)} className={cn(ENTER_CLASS, "rounded-2xl border border-border-card bg-card p-5")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Donut of paid vs outstanding invoice money. */
export function SpendingCard({ paid, outstanding, href, index }: { paid: number; outstanding: number; href: string; index: number }) {
  const mounted = useMounted();
  const total = paid + outstanding;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const paidShare = total ? paid / total : 0;
  return (
    <ChartCard title="Spending" subtitle="Invoices paid vs. still due" href={href} index={index}>
      <div className="flex items-center gap-6">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="11" className="stroke-amber-400/30" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out"
              strokeDasharray={circumference}
              strokeDashoffset={mounted ? circumference * (1 - paidShare) : circumference}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Total</span>
            <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
        <dl className="grid flex-1 gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-primary" /> Paid
            </dt>
            <dd className="font-semibold tabular-nums">{formatMoney(paid)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-amber-400" /> Outstanding
            </dt>
            <dd className="font-semibold tabular-nums">{formatMoney(outstanding)}</dd>
          </div>
          <p className="text-xs text-muted-foreground">
            {total ? `${Math.round(paidShare * 100)}% of your invoices are paid.` : "No invoices yet."}
          </p>
        </dl>
      </div>
    </ChartCard>
  );
}

/** Segmented bar of estimates by status, with a legend. */
export function StatusBreakdownCard({
  title,
  subtitle,
  href,
  index,
  segments,
}: {
  title: string;
  subtitle: string;
  href: string;
  index: number;
  segments: { label: string; value: number; tone: MetricTone }[];
}) {
  const mounted = useMounted();
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle} href={href} index={index}>
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full bg-muted">
        {total
          ? segments
              .filter((item) => item.value > 0)
              .map((item) => (
                <div
                  key={item.label}
                  title={`${item.label}: ${item.value}`}
                  className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONES[item.tone].bar)}
                  style={{ width: mounted ? `${(item.value / total) * 100}%` : "0%" }}
                />
              ))
          : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 truncate text-muted-foreground">
              <span className={cn("size-2.5 shrink-0 rounded-full", TONES[item.tone].bar)} />
              {item.label}
            </dt>
            <dd className="font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </ChartCard>
  );
}
