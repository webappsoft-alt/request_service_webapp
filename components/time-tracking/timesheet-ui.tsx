"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, CalendarX2, Check, ChevronDown, Loader2, Users } from "lucide-react";
import { PortalDataTable, type PortalTableColumn } from "@/components/portal/portal-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNow } from "@/components/time-tracking/time-tracking-ui";
import { formatMoney } from "@/lib/format";
import type {
  LedgerRow,
  LedgerSummary,
  TechnicianPaymentMethod,
  TechnicianPaymentRecord,
} from "@/lib/api/technician-client";
import {
  dateKey,
  formatClockTime,
  formatDuration,
  formatEntryDate,
  formatExactDuration,
  formatHoursShort,
  formatTimer,
  liveSeconds,
  startOfWeek,
  todayInputValue,
  type TimeEntry,
  type TimeSummary,
} from "@/lib/time-tracking";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { recordTechnicianPaymentThunk } from "@/store/timeTrackingSlice";

export type RecordKind = "job" | "estimate";
export type HrefFor = (kind: RecordKind, id: string) => string;

/* ───────────────────────────── Ledger helpers ───────────────────────────── */

/** Same key the backend ledger groups by: technician + job (or estimate when no job). */
export function ledgerRowKey(employeeId: string, jobId?: string | null, estimateId?: string | null) {
  return `${employeeId}|${jobId || ""}|${jobId ? "" : estimateId || ""}`;
}

export function entryLedgerKey(entry: TimeEntry) {
  return ledgerRowKey(entry.employeeId, entry.job?.id, entry.estimate?.id);
}

export function ledgerRowKind(row: Pick<LedgerRow, "jobId">): RecordKind {
  return row.jobId ? "job" : "estimate";
}

export function sumLedger(rows: LedgerRow[]): LedgerSummary {
  const totals = rows.reduce(
    (acc, row) => ({
      totalSeconds: acc.totalSeconds + row.seconds,
      sessions: acc.sessions + row.sessions,
      earned: acc.earned + row.earned,
      paid: acc.paid + row.paid,
      remaining: acc.remaining + row.remaining,
    }),
    { totalSeconds: 0, sessions: 0, earned: 0, paid: 0, remaining: 0 },
  );
  const cents = (value: number) => Math.round(value * 100) / 100;
  return { ...totals, earned: cents(totals.earned), paid: cents(totals.paid), remaining: cents(totals.remaining) };
}

const METHOD_LABEL: Record<TechnicianPaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  ach: "Bank transfer (ACH)",
};

function RecordTag({
  kind,
  record,
  hrefFor,
  className,
}: {
  kind: RecordKind;
  record: { id: string; number?: string; title?: string } | null;
  hrefFor?: HrefFor;
  className?: string;
}) {
  if (!record) return <span className="text-muted-foreground">—</span>;
  const label = record.number ? `#${record.number}` : kind === "job" ? "Job" : "Estimate";
  const tone =
    kind === "job"
      ? "border-[var(--tech-accent,#003F7D)]/20 bg-[#e8eef5] text-[var(--tech-accent,#003F7D)] dark:bg-[var(--tech-accent,#003F7D)]/25 dark:text-blue-100"
      : "border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
  const chip = (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        tone,
        className,
      )}
      title={record.title || label}
    >
      {label}
    </span>
  );
  const href = hrefFor?.(kind, record.id);
  return href ? (
    <Link href={href} className="max-w-full hover:opacity-80" onClick={(event) => event.stopPropagation()}>
      {chip}
    </Link>
  ) : (
    chip
  );
}

/** Job / estimate number as a real link with its title underneath. */
function RecordLink({
  kind,
  record,
  hrefFor,
}: {
  kind: RecordKind;
  record: { id: string; number?: string; title?: string } | null;
  hrefFor?: HrefFor;
}) {
  if (!record) return <span className="text-muted-foreground">—</span>;
  const label = record.number || (kind === "job" ? "Job" : "Estimate");
  const href = hrefFor?.(kind, record.id);
  return (
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          {label}
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      ) : (
        <span className="font-semibold">{label}</span>
      )}
      {record.title ? <p className="max-w-56 truncate text-xs text-muted-foreground">{record.title}</p> : null}
    </div>
  );
}

/* ───────────────────────────── KPI strip ───────────────────────────── */

function Stat({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-[#94a3b8] bg-card px-3 py-2.5 dark:border-border", className)}>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("truncate text-base font-semibold text-foreground tabular-nums", valueClassName)}>{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * One compact strip: total hours (exact h/m/s), total pay, paid, remaining,
 * sessions with job / estimate counts, and a live "clocked in" indicator.
 */
export function TimesheetKpis({
  summary,
  ledger,
  payRate,
  clockedInLabel,
}: {
  summary: TimeSummary;
  /** Paid / remaining balance (omit to hide those cells). */
  ledger?: LedgerSummary | null;
  payRate?: number;
  clockedInLabel?: string;
}) {
  const live = summary.activeSessions > 0;
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", ledger ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
      <Stat
        className="border-l-4 border-l-[var(--tech-accent,#003F7D)] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        valueClassName="text-xl text-[var(--tech-accent,#003F7D)] dark:text-blue-200"
        label="Total hours"
        value={formatHoursShort(summary.totalSeconds)}
        hint={formatExactDuration(summary.totalSeconds)}
      />
      <Stat
        className="border-l-4 border-l-[var(--tech-accent,#003F7D)] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        valueClassName="text-xl text-[var(--tech-accent,#003F7D)] dark:text-blue-200"
        label="Total pay"
        value={formatMoney(summary.totalPay)}
        hint={payRate != null && payRate > 0 ? `Hours × ${formatMoney(payRate)}/hr` : "Hours × pay rate"}
      />
      {ledger ? (
        <>
          <Stat
            label="Paid"
            value={<span className="text-emerald-700 dark:text-emerald-300">{formatMoney(ledger.paid)}</span>}
            hint={`of ${formatMoney(ledger.earned)} earned`}
          />
          <Stat
            label="Remaining"
            value={
              <span className={ledger.remaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                {formatMoney(ledger.remaining)}
              </span>
            }
            hint={ledger.remaining > 0 ? "Owed to technicians" : "All paid"}
          />
        </>
      ) : null}
      <Stat
        label="Sessions"
        value={summary.sessions}
        hint={`${summary.jobs} job${summary.jobs === 1 ? "" : "s"} · ${summary.estimates} estimate${summary.estimates === 1 ? "" : "s"}`}
      />
      <Stat
        className={cn(live && "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10")}
        label="Clocked in"
        value={
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2.5" aria-hidden>
              {live ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" /> : null}
              <span className={cn("relative inline-flex size-2.5 rounded-full", live ? "bg-emerald-600" : "bg-slate-300")} />
            </span>
            {live ? (clockedInLabel ?? `${summary.activeSessions} live`) : "No one"}
          </span>
        }
        hint={live ? "Timer running" : "No running timer"}
      />
    </div>
  );
}

/* ───────────────────────────── Filters ───────────────────────────── */

export type EmployeeOption = { id: string; label: string; role?: string; hourlyRate?: number; loginEnabled?: boolean };

/** Technician multi-select (empty selection = all technicians). */
export function TechnicianMultiSelect({
  options,
  value,
  onChange,
}: {
  options: EmployeeOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const label =
    value.length === 0
      ? "All technicians"
      : value.length === 1
        ? options.find((o) => o.id === value[0])?.label || "1 technician"
        : `${value.length} technicians`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 max-w-56 justify-between gap-2">
          <Users className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onChange([])}>
          <Check className={cn("size-3.5", value.length ? "opacity-0" : "opacity-100")} aria-hidden />
          All technicians
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No team members yet.</p>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={value.includes(option.id)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange(checked ? [...value, option.id] : value.filter((id) => id !== option.id))
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Estimates" / "Jobs" toggles — at least one stays selected. */
export function RecordTypeFilter({ value, onChange }: { value: RecordKind[]; onChange: (next: RecordKind[]) => void }) {
  const items: { id: RecordKind; label: string }[] = [
    { id: "job", label: "Jobs" },
    { id: "estimate", label: "Estimates" },
  ];
  return (
    <div className="flex items-center gap-3 rounded-md border border-input bg-card px-2.5 py-1.5" role="group" aria-label="Record type">
      {items.map((item) => {
        const checked = value.includes(item.id);
        return (
          <label key={item.id} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
            <Checkbox
              checked={checked}
              disabled={checked && value.length === 1}
              onCheckedChange={(next) =>
                onChange(next ? [...value, item.id] : value.filter((kind) => kind !== item.id))
              }
            />
            {item.label}
          </label>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Calendar board ───────────────────────────── */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 86_400_000;

type BoardDay = { key: string; date: Date; entries: TimeEntry[]; outside: boolean };

/**
 * Calendar rows (Mon–Sun) for the range: short ranges (a week, a month) show
 * every week as one continuous grid; long ranges (all time) only weeks with time.
 */
function buildRows(entries: TimeEntry[], from?: string, to?: string): BoardDay[][] {
  const byDay = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = dateKey(entry.clockInAt);
    const list = byDay.get(key) ?? [];
    list.push(entry);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));

  const fromKey = from ? dateKey(from) : "";
  let toKey = to ? dateKey(to) : "";
  if (to && toKey === todayInputValue()) {
    const weekEnd = startOfWeek(to);
    weekEnd.setDate(weekEnd.getDate() + 6);
    toKey = dateKey(weekEnd);
  }
  const starts = new Map<number, Date>();
  let continuous = false;
  if (from && to) {
    const first = startOfWeek(from);
    const last = startOfWeek(to);
    const weeks = Math.round((last.getTime() - first.getTime()) / (7 * DAY_MS)) + 1;
    if (weeks <= 6) {
      continuous = true;
      for (let i = 0; i < weeks; i += 1) {
        const start = new Date(first);
        start.setDate(first.getDate() + i * 7);
        starts.set(start.getTime(), start);
      }
    }
  }
  if (!continuous) {
    for (const entry of entries) {
      const start = startOfWeek(entry.clockInAt);
      starts.set(start.getTime(), start);
    }
  }
  if (!starts.size) {
    const start = startOfWeek(new Date());
    starts.set(start.getTime(), start);
  }

  return [...starts.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((start) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const key = dateKey(date);
        return {
          key,
          date,
          entries: byDay.get(key) ?? [],
          outside: continuous && Boolean((fromKey && key < fromKey) || (toKey && key > toKey)),
        };
      }),
    );
}

function entryPay(entry: TimeEntry, seconds: number) {
  return entry.status === "active" ? Math.round((seconds / 3600) * entry.payRate * 100) / 100 : entry.pay;
}

function SessionCard({
  entry,
  now,
  showEmployee,
  hrefFor,
  ledgerRow,
  onPay,
  onStop,
  stopping,
}: {
  entry: TimeEntry;
  now: number;
  showEmployee?: boolean;
  hrefFor?: HrefFor;
  ledgerRow?: LedgerRow;
  onPay?: (row: LedgerRow) => void;
  onStop?: (entry: TimeEntry) => void;
  stopping?: boolean;
}) {
  const running = entry.status === "active";
  const seconds = liveSeconds(entry, now);
  const kind: RecordKind = entry.job ? "job" : "estimate";
  const record = entry.job ?? entry.estimate;

  let action: ReactNode = null;
  if (running) {
    action = onStop ? (
      <Button size="xs" variant="outline" className="h-5 px-1.5 text-[10px]" disabled={stopping} onClick={() => onStop(entry)}>
        {stopping ? "…" : "Clock out"}
      </Button>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" aria-hidden />
        Live
      </span>
    );
  } else if (ledgerRow && ledgerRow.remaining > 0) {
    action = onPay && ledgerRow.payable !== false ? (
      <Button
        size="xs"
        className="h-5 bg-[var(--tech-accent,#003F7D)] px-1.5 text-[10px] text-white hover:bg-[var(--tech-accent,#003F7D)]/90"
        onClick={() => onPay(ledgerRow)}
        title={`${formatMoney(ledgerRow.remaining)} unpaid on this ${kind}`}
      >
        Pay
      </Button>
    ) : (
      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Unpaid</span>
    );
  } else if (ledgerRow && ledgerRow.earned > 0) {
    action = (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <Check className="size-3" aria-hidden /> Paid
      </span>
    );
  }

  return (
    <article
      title={[record?.title, `${formatMoney(entry.payRate)}/hr`].filter(Boolean).join(" · ")}
      className={cn(
        "space-y-1 rounded-md border bg-card p-1.5 text-[11px] leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        running ? "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-500/50 dark:ring-emerald-500/20" : "border-[#94a3b8] dark:border-border",
        kind === "job" ? "border-l-[3px] border-l-[var(--tech-accent,#003F7D)]" : "border-l-[3px] border-l-amber-400",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <RecordTag kind={kind} record={record} hrefFor={hrefFor} className="px-1 py-0 text-[10px]" />
        <span className="shrink-0 text-[10px] font-semibold tabular-nums">
          {running ? formatTimer(seconds) : formatDuration(seconds)}
        </span>
      </div>
      {showEmployee && entry.employee?.name ? <p className="truncate font-medium text-foreground">{entry.employee.name}</p> : null}
      <p className="text-muted-foreground tabular-nums">
        {formatClockTime(entry.clockInAt)} – {running ? "now" : formatClockTime(entry.clockOutAt)}
      </p>
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">{formatMoney(entryPay(entry, seconds))}</span>
        {action}
      </div>
    </article>
  );
}

/**
 * Card-based timesheet calendar: one Mon–Sun grid (a week is one row, a month
 * is one grid), no hourly slots. Sessions stack as cards under their day.
 */
export function WeekBoard({
  entries,
  from,
  to,
  loading,
  showEmployee,
  hrefFor,
  ledgerByKey,
  onPay,
  onStop,
  stoppingId,
}: {
  entries: TimeEntry[];
  from?: string;
  to?: string;
  loading?: boolean;
  showEmployee?: boolean;
  hrefFor?: HrefFor;
  ledgerByKey?: Map<string, LedgerRow>;
  onPay?: (row: LedgerRow) => void;
  onStop?: (entry: TimeEntry) => void;
  stoppingId?: string | null;
}) {
  const now = useNow(entries.some((entry) => entry.status === "active"));
  const rows = useMemo(() => buildRows(entries, from, to), [entries, from, to]);
  const todayKey = todayInputValue();
  // Highlight today's weekday column only when today is on the board.
  const todayColumn = rows.flat().some((day) => day.key === todayKey) ? (new Date().getDay() + 6) % 7 : -1;

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#94a3b8] dark:border-border bg-card">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-start justify-center bg-card/50 pt-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : null}
      <div className="hidden grid-cols-7 border-b border-[#94a3b8] dark:border-border md:grid">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={cn(
              "border-r border-[#94a3b8] dark:border-border px-2 py-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase last:border-r-0",
              index === todayColumn
                ? "bg-[#e8eef5] text-[var(--tech-accent,#003F7D)] dark:bg-[var(--tech-accent,#003F7D)]/25 dark:text-blue-100"
                : "bg-slate-50 text-slate-500 dark:bg-muted/40 dark:text-muted-foreground",
            )}
          >
            {day}
            {index === todayColumn ? <span className="ml-1.5 font-medium tracking-normal normal-case">· Today</span> : null}
          </div>
        ))}
      </div>
      {entries.length === 0 && !loading ? (
        <p className="flex items-center justify-center gap-2 border-b border-[#94a3b8] dark:border-border px-3 py-2 text-xs text-muted-foreground md:hidden">
          <CalendarX2 className="size-3.5" aria-hidden /> No hours in this period.
        </p>
      ) : null}
      {rows.map((row, rowIndex) => (
        <div key={row[0].key} className="grid grid-cols-1 border-[#94a3b8] dark:border-border md:grid-cols-7 md:border-b md:last:border-b-0">
          {row.map((day, dayIndex) => {
            const daySeconds = day.entries.reduce((sum, entry) => sum + liveSeconds(entry, now), 0);
            const isToday = day.key === todayKey;
            const showMonth = day.date.getDate() === 1 || dayIndex === 0 || rowIndex === 0;
            return (
              <div
                key={day.key}
                className={cn(
                  "flex min-h-24 min-w-0 flex-col gap-1 border-[#94a3b8] dark:border-border p-1.5 md:border-r md:last:border-r-0",
                  day.outside && "bg-slate-50/80 dark:bg-muted/30",
                  isToday && "bg-[#e8eef5]/40 dark:bg-[var(--tech-accent,#003F7D)]/10",
                  // Mobile: only days with time (or today) are listed.
                  !day.entries.length && !isToday && "hidden md:flex",
                  "border-b md:border-b-0",
                )}
              >
                <div className="flex items-center justify-between gap-1 px-0.5">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      day.outside ? "text-slate-400" : "text-slate-600 dark:text-muted-foreground",
                    )}
                  >
                    <span className="mr-1 md:hidden">{WEEKDAYS[dayIndex]}</span>
                    {isToday ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8eef5] px-1.5 text-[var(--tech-accent,#003F7D)] ring-1 ring-[var(--tech-accent,#003F7D)]/20 dark:bg-[var(--tech-accent,#003F7D)]/30 dark:text-blue-100">
                        {showMonth ? day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : day.date.getDate()}
                      </span>
                    ) : showMonth ? (
                      day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    ) : (
                      day.date.getDate()
                    )}
                  </span>
                  {daySeconds > 0 ? (
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">{formatDuration(daySeconds)}</span>
                  ) : null}
                </div>
                {day.entries.map((entry) => (
                  <SessionCard
                    key={entry.id}
                    entry={entry}
                    now={now}
                    showEmployee={showEmployee}
                    hrefFor={hrefFor}
                    ledgerRow={ledgerByKey?.get(entryLedgerKey(entry))}
                    onPay={onPay}
                    onStop={onStop}
                    stopping={stoppingId === entry.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Ledger tables ───────────────────────────── */

export function LedgerTable({
  rows,
  showEmployee,
  hrefFor,
  onPay,
  loading,
  empty = "No completed sessions yet — pay is earned once a technician clocks out.",
}: {
  rows: LedgerRow[];
  showEmployee?: boolean;
  hrefFor?: HrefFor;
  onPay?: (row: LedgerRow) => void;
  loading?: boolean;
  empty?: string;
}) {
  const recordOf = (row: LedgerRow) => (ledgerRowKind(row) === "job" ? row.job : row.estimate);
  const columns: PortalTableColumn<LedgerRow>[] = [
    ...(showEmployee
      ? [
          {
            id: "technician",
            header: "Technician",
            sortValue: (row: LedgerRow) => row.employeeName,
            exportValue: (row: LedgerRow) => row.employeeName,
            cell: (row: LedgerRow) => <span className="font-medium">{row.employeeName || "Technician"}</span>,
          },
        ]
      : []),
    {
      id: "record",
      header: "Job / estimate",
      sortValue: (row) => recordOf(row)?.number || "",
      exportValue: (row) => [recordOf(row)?.number, recordOf(row)?.title].filter(Boolean).join(" · "),
      cell: (row) => <RecordLink kind={ledgerRowKind(row)} record={recordOf(row)} hrefFor={hrefFor} />,
    },
    {
      id: "time",
      header: "Time worked",
      sortValue: (row) => row.seconds,
      exportValue: (row) => formatExactDuration(row.seconds),
      className: "whitespace-nowrap tabular-nums",
      cell: (row) => formatExactDuration(row.seconds),
    },
    {
      id: "sessions",
      header: "Sessions",
      sortValue: (row) => row.sessions,
      exportValue: (row) => String(row.sessions),
      className: "tabular-nums",
      cell: (row) => row.sessions,
    },
    {
      id: "rate",
      header: "Pay rate",
      sortValue: (row) => row.payRate,
      exportValue: (row) => `${formatMoney(row.payRate)}/hr`,
      className: "whitespace-nowrap tabular-nums",
      cell: (row) => `${formatMoney(row.payRate)}/hr`,
    },
    {
      id: "earned",
      header: "Earned",
      sortValue: (row) => row.earned,
      exportValue: (row) => formatMoney(row.earned),
      className: "font-medium tabular-nums",
      cell: (row) => formatMoney(row.earned),
    },
    {
      id: "paid",
      header: "Paid",
      sortValue: (row) => row.paid,
      exportValue: (row) => formatMoney(row.paid),
      className: "tabular-nums",
      cell: (row) => <span className="text-emerald-700 dark:text-emerald-300">{formatMoney(row.paid)}</span>,
    },
    {
      id: "remaining",
      header: "Remaining",
      sortValue: (row) => row.remaining,
      exportValue: (row) => formatMoney(row.remaining),
      className: "font-semibold tabular-nums",
      cell: (row) => (
        <span className={row.remaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
          {formatMoney(row.remaining)}
        </span>
      ),
    },
    ...(onPay
      ? [
          {
            id: "action",
            header: "Action",
            cell: (row: LedgerRow) =>
              row.remaining > 0 && row.payable === false ? (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300" title="Pay once the completed work is approved">
                  Awaiting approval
                </span>
              ) : row.remaining > 0 ? (
                <Button size="xs" className="bg-[var(--tech-accent,#003F7D)] text-white hover:bg-[var(--tech-accent,#003F7D)]/90" onClick={() => onPay(row)}>
                  Pay
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3" aria-hidden /> Paid
                </span>
              ),
          },
        ]
      : []),
  ];

  return (
    <PortalDataTable
      filename="technician-pay"
      countLabel="Jobs"
      hideSearch
      rows={rows}
      rowKey={(row) => ledgerRowKey(row.employeeId, row.jobId, row.estimateId)}
      columns={columns}
      loading={Boolean(loading)}
      empty={loading ? "Loading pay…" : empty}
      pageSize={10}
    />
  );
}

export function PaymentHistoryTable({
  payments,
  showEmployee,
  hrefFor,
  loading,
  pagination,
  empty = "No payments recorded yet.",
}: {
  payments: TechnicianPaymentRecord[];
  showEmployee?: boolean;
  hrefFor?: HrefFor;
  loading?: boolean;
  /** Server pagination; without it the rows page locally, 10 per page. */
  pagination?: { page: number; pageSize: number; total: number; totalPages: number; onPageChange: (page: number) => void };
  empty?: string;
}) {
  const kindOf = (payment: TechnicianPaymentRecord): RecordKind => (payment.job ? "job" : "estimate");
  const recordOf = (payment: TechnicianPaymentRecord) => payment.job ?? payment.estimate;
  const columns: PortalTableColumn<TechnicianPaymentRecord>[] = [
    {
      id: "number",
      header: "Payment",
      sortValue: (row) => row.number,
      exportValue: (row) => row.number,
      className: "font-medium tabular-nums",
      cell: (row) => row.number || "—",
    },
    {
      id: "date",
      header: "Date",
      sortValue: (row) => row.paidAt,
      exportValue: (row) => formatEntryDate(row.paidAt),
      className: "whitespace-nowrap",
      cell: (row) => formatEntryDate(row.paidAt),
    },
    ...(showEmployee
      ? [
          {
            id: "technician",
            header: "Technician",
            sortValue: (row: TechnicianPaymentRecord) => row.employeeName,
            exportValue: (row: TechnicianPaymentRecord) => row.employeeName,
            cell: (row: TechnicianPaymentRecord) => row.employeeName || "—",
          },
        ]
      : []),
    {
      id: "record",
      header: "Job / estimate",
      sortValue: (row) => recordOf(row)?.number || "",
      exportValue: (row) => [recordOf(row)?.number, recordOf(row)?.title].filter(Boolean).join(" · "),
      cell: (row) => <RecordLink kind={kindOf(row)} record={recordOf(row)} hrefFor={hrefFor} />,
    },
    {
      id: "method",
      header: "Method",
      sortValue: (row) => row.method,
      exportValue: (row) => METHOD_LABEL[row.method] ?? row.method,
      cell: (row) => METHOD_LABEL[row.method] ?? row.method,
    },
    {
      id: "reference",
      header: "Reference",
      exportValue: (row) => row.reference || row.notes,
      cell: (row) => (
        <span className="block max-w-48 truncate text-muted-foreground" title={row.notes || undefined}>
          {row.reference || row.notes || "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      exportValue: () => "Paid",
      cell: () => (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="size-3" aria-hidden /> Paid
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      sortValue: (row) => row.amount,
      exportValue: (row) => formatMoney(row.amount),
      className: "font-semibold tabular-nums",
      cell: (row) => formatMoney(row.amount),
    },
  ];

  return (
    <PortalDataTable
      filename="technician-payments"
      countLabel="Payments"
      hideSearch
      rows={payments}
      rowKey={(row) => row.id}
      columns={columns}
      loading={Boolean(loading)}
      empty={empty}
      pageSize={pagination?.pageSize ?? 10}
      serverPagination={
        pagination
          ? {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              totalPages: pagination.totalPages,
              onPageChange: pagination.onPageChange,
              search: "",
              onSearchChange: () => undefined,
            }
          : undefined
      }
    />
  );
}

/* ───────────────────────────── Pay technician ───────────────────────────── */

const PAY_METHODS: TechnicianPaymentMethod[] = ["cash", "check", "ach", "card"];

/**
 * Record a provider → technician payout against one job (or estimate).
 * Mirrors the customer "Apply payment" dialog but writes to the separate
 * technician-payments ledger. Remount with a new `key` per row to reset.
 */
export function PayTechnicianDialog({
  row,
  open,
  onOpenChange,
  onPaid,
}: {
  row: LedgerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.timeTracking?.paying ?? false);
  const [amount, setAmount] = useState(row && row.remaining > 0 ? row.remaining.toFixed(2) : "");
  const [method, setMethod] = useState<TechnicianPaymentMethod>("cash");
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const value = Number(amount);
  const tooMuch = Boolean(row) && value > (row?.remaining ?? 0) + 0.001;
  const invalid = !row || !Number.isFinite(value) || value <= 0 || tooMuch;
  const kind = row ? ledgerRowKind(row) : "job";
  const record = row ? (kind === "job" ? row.job : row.estimate) : null;

  async function save() {
    if (!row || invalid) return;
    const result = await dispatch(
      recordTechnicianPaymentThunk({
        employeeId: row.employeeId,
        jobId: row.jobId,
        estimateId: row.jobId ? null : row.estimateId,
        amount: Math.round(value * 100) / 100,
        method,
        paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    );
    if (recordTechnicianPaymentThunk.rejected.match(result)) {
      toast.error(result.payload || "Could not record this payment.");
      return;
    }
    toast.success(`${formatMoney(value)} paid to ${row.employeeName || "technician"}.`);
    onPaid?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Pay technician</DialogTitle>
          <DialogDescription>
            {row
              ? `Record a payout to ${row.employeeName || "this technician"} for ${record?.number ? `#${record.number}` : `this ${kind}`}. Technician payments are tracked separately from customer payments.`
              : "Select a job first."}
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 rounded-[4px] border border-input bg-muted/40 px-3 py-2.5 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Earned</p>
                <p className="font-semibold tabular-nums">{formatMoney(row.earned)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{formatExactDuration(row.seconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(row.paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">{formatMoney(row.remaining)}</p>
              </div>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Amount
              <Input
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                max={row.remaining}
                value={amount}
                disabled={saving}
                aria-invalid={tooMuch || undefined}
                onChange={(event) => setAmount(event.target.value)}
              />
              {tooMuch ? (
                <span className="text-xs font-normal text-destructive">
                  Cannot exceed the remaining {formatMoney(row.remaining)}.
                </span>
              ) : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Method
              <Select value={method} disabled={saving} onValueChange={(next) => setMethod(next as TechnicianPaymentMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="z-[100] w-[var(--radix-select-trigger-width)]">
                  {PAY_METHODS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {METHOD_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Payment date
              <Input type="date" value={paidAt} disabled={saving} onChange={(event) => setPaidAt(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Reference (optional)
              <Input
                placeholder={method === "check" ? "Check number" : "e.g. transfer ID"}
                value={reference}
                disabled={saving}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Notes (optional)
              <Input placeholder="Internal notes" value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[var(--tech-accent,#003F7D)] text-white hover:bg-[var(--tech-accent,#003F7D)]/90"
            disabled={invalid || saving}
            onClick={() => void save()}
          >
            {saving ? "Recording…" : `Pay ${Number.isFinite(value) && value > 0 ? formatMoney(value) : ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shared state for opening the pay dialog from any card or row. */
export function usePayDialog() {
  const [row, setRow] = useState<LedgerRow | null>(null);
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  return {
    row,
    open,
    /** Remount key so the form resets for each payout. */
    key: `${row ? ledgerRowKey(row.employeeId, row.jobId, row.estimateId) : "none"}:${nonce}`,
    start(next: LedgerRow) {
      setRow(next);
      setNonce((value) => value + 1);
      setOpen(true);
    },
    setOpen,
  };
}

