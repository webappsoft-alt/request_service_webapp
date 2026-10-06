"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchTimeEntries,
  selectTimeList,
  stopTimeEntryThunk,
} from "@/store/timeTrackingSlice";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { formatMoney } from "@/lib/format";
import { formatDuration, formatHours, resolveTimeRange, type TimeEntry, type TimeRange } from "@/lib/time-tracking";
import {
  TimeByDayTable,
  TimeByEmployeeTable,
  TimeEntriesTable,
  TimeRangeFilter,
  TimeStat,
  TimeSummaryCards,
} from "@/components/time-tracking/time-tracking-ui";

const PAGE_SIZE = 20;

export type TimeTrackingPanelProps = {
  /** Slice cache key, e.g. `tech`, `employee:<id>`, `job:<id>`. */
  scopeKey: string;
  /** Technician portal (own data) vs provider portal (scoped by ids below). */
  technician?: boolean;
  employeeId?: string;
  jobId?: string;
  estimateId?: string;
  defaultRange?: TimeRange;
  payRate?: number;
  /** Provider employee view: show all-time totals beside the filtered totals. */
  includeOverall?: boolean;
  showEmployee?: boolean;
  showByEmployee?: boolean;
  showByDay?: boolean;
  /** Provider only: allow stopping a technician's running timer. */
  allowStop?: boolean;
  hrefFor?: (kind: "job" | "estimate", id: string) => string;
  header?: ReactNode;
};

export function TimeTrackingPanel({
  scopeKey,
  technician = false,
  employeeId,
  jobId,
  estimateId,
  defaultRange = { preset: "month" },
  payRate,
  includeOverall = false,
  showEmployee = false,
  showByEmployee = false,
  showByDay = true,
  allowStop = false,
  hrefFor,
  header,
}: TimeTrackingPanelProps) {
  const dispatch = useAppDispatch();
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [page, setPage] = useState(1);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const list = useAppSelector((state) => selectTimeList(state, scopeKey));
  const version = useAppSelector((state) => state.timeTracking?.version ?? 0);
  const resolved = useMemo(() => resolveTimeRange(range), [range]);

  const query = useMemo(
    () => ({
      employeeId,
      jobId,
      estimateId,
      from: resolved.from,
      to: resolved.to,
      page,
      limit: PAGE_SIZE,
      includeOverall,
    }),
    [employeeId, jobId, estimateId, resolved.from, resolved.to, page, includeOverall],
  );

  useEffect(() => {
    void dispatch(fetchTimeEntries({ scopeKey, query, technician }));
  }, [dispatch, scopeKey, query, technician]);

  // A clock-in/out anywhere (this tab, another device, or the office) refreshes totals.
  useEffect(() => {
    if (!version) return;
    void dispatch(fetchTimeEntries({ scopeKey, query, technician, force: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when version bumps
  }, [version]);

  // Provider pages do not mount the technician bridge, so listen for socket updates here.
  useEffect(() => {
    if (technician) return;
    return subscribeRealtime((detail) => {
      if (detail?.type !== "TIME_ENTRY_UPDATED") return;
      // Entry refs may be ids or populated objects — match on the serialized payload.
      const entry = (detail.payload as { entry?: unknown } | undefined)?.entry;
      const text = entry ? JSON.stringify(entry) : "";
      const ids = [employeeId, jobId, estimateId].filter(Boolean) as string[];
      if (!entry || ids.some((id) => text.includes(id))) {
        void dispatch(fetchTimeEntries({ scopeKey, query, technician, force: true }));
      }
    });
  }, [dispatch, technician, scopeKey, query, employeeId, jobId, estimateId]);

  async function stop(entry: TimeEntry) {
    setStoppingId(entry.id);
    const result = await dispatch(stopTimeEntryThunk(entry.id));
    setStoppingId(null);
    if (stopTimeEntryThunk.rejected.match(result)) {
      toast.error(result.payload || "Could not stop the timer.");
    } else {
      toast.success("Timer stopped and time entry saved.");
    }
  }

  const overall = list.overall;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {header ?? <div />}
        <TimeRangeFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
        />
      </div>

      <TimeSummaryCards summary={list.summary} payRate={payRate} />

      {includeOverall && overall ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TimeStat label="All-time hours" value={formatHours(overall.totalSeconds)} hint={formatDuration(overall.totalSeconds)} />
          <TimeStat label="All-time pay" value={formatMoney(overall.totalPay)} hint="Tracked hours × rate" />
          <TimeStat label="All-time sessions" value={overall.sessions} />
          <TimeStat label="Jobs / estimates" value={`${overall.jobs} / ${overall.estimates}`} />
        </div>
      ) : null}

      {list.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{list.error}</p>
      ) : null}

      {showByEmployee && list.summary.byEmployee.length ? (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">By technician</h3>
          <TimeByEmployeeTable rows={list.summary.byEmployee} />
        </section>
      ) : null}

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Sessions ({list.total})
        </h3>
        <TimeEntriesTable
          entries={list.items}
          loading={list.loading}
          showEmployee={showEmployee}
          hrefFor={hrefFor}
          onStop={allowStop ? (entry) => void stop(entry) : undefined}
          stoppingId={stoppingId}
          pagination={{
            page: list.page,
            pageSize: PAGE_SIZE,
            total: list.total,
            totalPages: list.totalPages,
            onPageChange: setPage,
          }}
        />
      </section>

      {showByDay && list.summary.byDay.length ? (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Daily breakdown</h3>
          <TimeByDayTable rows={list.summary.byDay} />
        </section>
      ) : null}
    </div>
  );
}
