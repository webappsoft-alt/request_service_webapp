"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarRange, Clock3, Loader2 } from "lucide-react";
import { PortalPagination } from "@/components/portal/portal-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import {
  formatClockTime,
  formatDuration,
  formatEntryDate,
  formatHours,
  formatTimer,
  liveSeconds,
  resolveTimeRange,
  todayInputValue,
  type TimeDayRow,
  type TimeEmployeeRow,
  type TimeEntry,
  type TimeRange,
  type TimeRangePreset,
  type TimeSummary,
} from "@/lib/time-tracking";
import { cn } from "@/lib/utils";

/** Re-render every second while `enabled` (drives live timers). */
export function useNow(enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/** Ticking HH:MM:SS for a running entry, computed from the server clock-in time. */
export function LiveTimer({ entry, className }: { entry: Pick<TimeEntry, "status" | "clockInAt" | "seconds">; className?: string }) {
  const now = useNow(entry.status === "active");
  return (
    <span className={cn("font-mono tabular-nums", className)} aria-live="off">
      {formatTimer(liveSeconds(entry, now))}
    </span>
  );
}

const PRESETS: { id: TimeRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
  { id: "all", label: "All time" },
];

export function TimeRangeFilter({
  value,
  onChange,
  presets = PRESETS.map((p) => p.id),
}: {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
  presets?: TimeRangePreset[];
}) {
  const [fromDate, setFromDate] = useState(value.fromDate || todayInputValue());
  const [toDate, setToDate] = useState(value.toDate || todayInputValue());
  const label = resolveTimeRange(value).label;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-md border border-input bg-card p-0.5" role="group" aria-label="Date range">
        {PRESETS.filter((p) => presets.includes(p.id)).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              onChange(
                preset.id === "custom"
                  ? { preset: "custom", fromDate, toDate }
                  : { preset: preset.id },
              )
            }
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
              value.preset === preset.id
                ? "bg-[#003F7D] text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-pressed={value.preset === preset.id}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value.preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={fromDate}
            max={toDate}
            aria-label="From date"
            onChange={(event) => setFromDate(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={toDate}
            min={fromDate}
            aria-label="To date"
            onChange={(event) => setToDate(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onChange({ preset: "custom", fromDate, toDate })}
          >
            Apply
          </Button>
        </div>
      ) : null}
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarRange className="size-3.5" aria-hidden />
        {label}
      </span>
    </div>
  );
}

export function TimeStat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-md border border-border-soft bg-card px-3 py-2.5", accent && "border-[#003F7D]/25 bg-[#e8eef5]")}>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TimeSummaryCards({
  summary,
  payRate,
  showPay = true,
}: {
  summary: TimeSummary;
  payRate?: number;
  showPay?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <TimeStat label="Total hours" value={formatHours(summary.totalSeconds)} hint={formatDuration(summary.totalSeconds)} accent />
      {showPay ? (
        <TimeStat
          label="Total pay"
          value={formatMoney(summary.totalPay)}
          hint={payRate != null ? `Hours × ${formatMoney(payRate)}/hr` : "Hours × pay rate"}
          accent
        />
      ) : null}
      <TimeStat label="Sessions" value={summary.sessions} hint="Clock-in / out" />
      <TimeStat label="Jobs" value={summary.jobs} hint="Worked on" />
      <TimeStat label="Estimates" value={summary.estimates} hint="Worked on" />
      <TimeStat
        label="Clocked in now"
        value={summary.activeSessions ? "Yes" : "No"}
        hint={summary.activeSessions ? "Timer running" : "No running timer"}
      />
    </div>
  );
}

function recordLink(entry: TimeEntry, kind: "job" | "estimate", hrefFor?: (kind: "job" | "estimate", id: string) => string) {
  const ref = kind === "job" ? entry.job : entry.estimate;
  if (!ref) return <span className="text-muted-foreground">—</span>;
  const label = ref.number || ref.title || "Open";
  const href = hrefFor?.(kind, ref.id);
  return (
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="font-semibold text-primary hover:underline">
          {label}
        </Link>
      ) : (
        <span className="font-semibold">{label}</span>
      )}
      {ref.title && ref.number ? <p className="truncate text-xs text-muted-foreground">{ref.title}</p> : null}
    </div>
  );
}

export function TimeEntriesTable({
  entries,
  loading,
  showEmployee = false,
  hrefFor,
  empty = "No time tracked in this period.",
  pagination,
  onStop,
  stoppingId,
}: {
  entries: TimeEntry[];
  loading?: boolean;
  showEmployee?: boolean;
  hrefFor?: (kind: "job" | "estimate", id: string) => string;
  empty?: string;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number; onPageChange: (page: number) => void };
  /** Provider only: stop a running timer. */
  onStop?: (entry: TimeEntry) => void;
  stoppingId?: string | null;
}) {
  const now = useNow(entries.some((entry) => entry.status === "active"));

  return (
    <div className="overflow-hidden rounded-md border border-border-soft bg-card">
      <div className="relative overflow-x-auto">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary text-[11px] tracking-[0.12em] uppercase">
              {showEmployee ? <TableHead>Technician</TableHead> : null}
              <TableHead>Job</TableHead>
              <TableHead>Estimate</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Pay</TableHead>
              {onStop ? <TableHead className="text-right">Action</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showEmployee ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">
                  {loading ? "Loading time entries…" : empty}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const seconds = liveSeconds(entry, now);
                const running = entry.status === "active";
                const pay = running ? Math.round((seconds / 3600) * entry.payRate * 100) / 100 : entry.pay;
                return (
                  <TableRow key={entry.id} className={cn(running && "bg-emerald-50/60")}>
                    {showEmployee ? (
                      <TableCell className="font-medium">{entry.employee?.name || "—"}</TableCell>
                    ) : null}
                    <TableCell>{recordLink(entry, "job", hrefFor)}</TableCell>
                    <TableCell>{recordLink(entry, "estimate", hrefFor)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatEntryDate(entry.clockInAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatClockTime(entry.clockInAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {running ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" aria-hidden />
                          Running
                        </span>
                      ) : (
                        formatClockTime(entry.clockOutAt)
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {running ? formatTimer(seconds) : formatDuration(seconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(entry.payRate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(pay)}</TableCell>
                    {onStop ? (
                      <TableCell className="text-right">
                        {running ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={stoppingId === entry.id}
                            onClick={() => onStop(entry)}
                          >
                            {stoppingId === entry.id ? "Stopping…" : "Clock out"}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? (
        <div className="px-2 pb-2">
          <PortalPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            itemName="sessions"
          />
        </div>
      ) : null}
    </div>
  );
}

export function TimeByEmployeeTable({ rows }: { rows: TimeEmployeeRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-md border border-border-soft bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary text-[11px] tracking-[0.12em] uppercase">
            <TableHead>Technician</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Time</TableHead>
            <TableHead className="text-right">Pay rate</TableHead>
            <TableHead className="text-right">Pay</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.employeeId}>
              <TableCell className="font-medium">
                <Link href={`/pro/dashboard/team/${row.employeeId}?tab=time`} className="text-primary hover:underline">
                  {row.name || "Technician"}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(row.seconds)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.hourlyRate)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.pay)}</TableCell>
              <TableCell className="text-right">
                {row.active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Clock3 className="size-3" aria-hidden /> Clocked in
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Off</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TimeByDayTable({ rows, showPay = true }: { rows: TimeDayRow[]; showPay?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-md border border-border-soft bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary text-[11px] tracking-[0.12em] uppercase">
            <TableHead>Day</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Jobs</TableHead>
            <TableHead className="text-right">Estimates</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            {showPay ? <TableHead className="text-right">Pay</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.date}>
              <TableCell className="font-medium whitespace-nowrap">
                {new Date(`${row.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
              <TableCell className="text-right tabular-nums">{row.jobs}</TableCell>
              <TableCell className="text-right tabular-nums">{row.estimates}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(row.seconds)}</TableCell>
              {showPay ? <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.pay)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
