"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { listProviderTimeEntries } from "@/lib/api/technician-client";
import { formatDate, formatMoney } from "@/lib/format";
import type { TimeEntry } from "@/lib/time-tracking";
import { cn } from "@/lib/utils";

type Range = "week" | "last_week" | "month";

const RANGES: Array<{ id: Range; label: string }> = [
  { id: "week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "month", label: "This month" },
];

function rangeBounds(range: Range) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "month") {
    start.setDate(1);
    return { from: start, to: now };
  }
  start.setDate(start.getDate() - start.getDay()); // Sunday
  if (range === "last_week") {
    const end = new Date(start.getTime() - 1);
    start.setDate(start.getDate() - 7);
    return { from: start, to: end };
  }
  return { from: start, to: now };
}

function timeOf(value: string | null) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

/**
 * Contractor clock-in sessions next to the technician board. Contractor time
 * is paid from each job's contractor ledger (fixed or hourly), not technician
 * payroll, so it lives in its own section.
 */
export function ContractorTimesheet() {
  const [range, setRange] = useState<Range>("week");
  const [rows, setRows] = useState<TimeEntry[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      if (String(detail?.type || "") === "TIME_ENTRY_UPDATED") setVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = rangeBounds(range);
    listProviderTimeEntries({
      participantType: "contractor",
      from: from.toISOString(),
      to: to.toISOString(),
      page: 1,
      limit: 200,
    })
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err && typeof err === "object" && "message" in err ? String(err.message) : "Could not load contractor hours.");
      });
    return () => {
      cancelled = true;
    };
  }, [range, version]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const seconds = list.reduce((sum, row) => sum + row.seconds, 0);
    return {
      hours: Math.round((seconds / 3600) * 100) / 100,
      pay: list.reduce((sum, row) => sum + row.pay, 0),
      people: new Set(list.map((row) => row.employeeId)).size,
    };
  }, [rows]);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#94a3b8] bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Handshake className="size-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Contractor hours</h2>
          <p className="text-xs text-muted-foreground">
            Time contractors clocked on their jobs. Paid from each contractor&apos;s Payouts tab, not technician payroll.
          </p>
        </div>
        <div className="ml-auto inline-flex rounded-md border border-input bg-card p-0.5" role="group" aria-label="Range">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={range === item.id}
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded-[4px] px-2.5 py-1 text-xs font-medium",
                range === item.id ? "bg-[#003F7D] text-white" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <p className="text-xs text-muted-foreground">
        {totals.hours} h · {totals.people} contractor{totals.people === 1 ? "" : "s"} · {formatMoney(totals.pay)} at hourly job rates
      </p>

      <PortalDataTable
        filename="contractor-hours"
        countLabel="Sessions"
        searchPlaceholder="Search contractor, job"
        loading={rows === null && !error}
        empty="No contractor time in this range."
        rows={rows ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            id: "contractor",
            header: "Contractor",
            sortValue: (row) => row.employee?.name || "",
            searchValue: (row) => `${row.employee?.name || ""} ${row.job?.number || ""}`,
            exportValue: (row) => row.employee?.name || "",
            cell: (row) =>
              row.employeeId ? (
                <Link href={`/pro/dashboard/contractors/${row.employeeId}?tab=time`} className="font-medium text-primary hover:underline">
                  {row.employee?.name || "Contractor"}
                </Link>
              ) : (
                row.employee?.name || "Contractor"
              ),
          },
          {
            id: "job",
            header: "Job",
            exportValue: (row) => row.job?.number || "",
            cell: (row) =>
              row.job ? (
                <Link href={`/pro/dashboard/jobs/${row.job.id}`} className="hover:underline">
                  {row.job.number}
                </Link>
              ) : (
                "—"
              ),
          },
          {
            id: "date",
            header: "Date",
            sortValue: (row) => row.clockInAt,
            exportValue: (row) => formatDate(row.clockInAt),
            cell: (row) => formatDate(row.clockInAt),
          },
          {
            id: "time",
            header: "In / out",
            exportValue: (row) => `${timeOf(row.clockInAt)} - ${timeOf(row.clockOutAt)}`,
            cell: (row) => (
              <span className="text-xs">
                {timeOf(row.clockInAt)} – {row.status === "active" ? <StatusPill tone="success" label="On the clock" /> : timeOf(row.clockOutAt)}
              </span>
            ),
          },
          {
            id: "hours",
            header: "Hours",
            className: "text-right",
            sortValue: (row) => row.seconds,
            exportValue: (row) => (row.seconds / 3600).toFixed(2),
            cell: (row) =>
              row.status === "active" ? (
                <LiveTimer entry={row} className="text-xs" />
              ) : (
                <span className="tabular-nums">{(row.seconds / 3600).toFixed(2)}</span>
              ),
          },
          {
            id: "pay",
            header: "Hourly pay",
            className: "text-right",
            sortValue: (row) => row.pay,
            exportValue: (row) => row.pay.toFixed(2),
            cell: (row) => <span className="tabular-nums">{row.payRate ? formatMoney(row.pay) : "Fixed job"}</span>,
          },
        ]}
      />
    </section>
  );
}
