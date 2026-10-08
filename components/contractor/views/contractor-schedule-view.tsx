"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { siteLine } from "@/components/contractor/contractor-ui";
import { PortalPage } from "@/components/portal/portal-page";
import { JobStatusPill } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { listContractorSchedule, type ContractorScheduleRow } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

const DAY_MS = 86400000;
const RANGE_DAYS = 14;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function clock(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function timeLabel(row: ContractorScheduleRow) {
  if (row.startAt) return row.endAt ? `${clock(row.startAt)} – ${clock(row.endAt)}` : clock(row.startAt);
  if (row.startMinutes === null || row.endMinutes === null) return "Time not set";
  return `${minutesLabel(row.startMinutes)} – ${minutesLabel(row.endMinutes)}`;
}

/** Multi-day jobs appear on every day they span inside the window. */
function groupByDay(rows: ContractorScheduleRow[], from: Date, days: number) {
  const groups = new Map<string, { date: Date; rows: ContractorScheduleRow[] }>();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(from.getTime() + i * DAY_MS);
    groups.set(dayKey(date), { date, rows: [] });
  }
  for (const row of rows) {
    const start = startOfDay(new Date(row.date));
    const end = startOfDay(new Date(row.endDate || row.date));
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      groups.get(dayKey(new Date(t)))?.rows.push(row);
    }
  }
  return [...groups.values()];
}

/** Contractor schedule — assigned jobs by day, using the office's time windows. */
export function ContractorScheduleView() {
  const version = useAppSelector((state) => state.contractorPortal.versions.schedule + state.contractorPortal.versions.jobs);
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [rows, setRows] = useState<ContractorScheduleRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const to = new Date(from.getTime() + RANGE_DAYS * DAY_MS - 1);
    listContractorSchedule({ startDate: from.toISOString(), endDate: to.toISOString() })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err && typeof err === "object" && "message" in err ? String(err.message) : "Could not load your schedule.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, version]);

  const days = useMemo(() => groupByDay(rows ?? [], from, RANGE_DAYS), [rows, from]);
  const todayKey = dayKey(new Date());
  const rangeLabel = `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(
    from.getTime() + (RANGE_DAYS - 1) * DAY_MS,
  ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function shift(direction: number) {
    setLoading(true);
    setFrom((current) => new Date(current.getTime() + direction * 7 * DAY_MS));
  }

  return (
    <PortalPage
      eyebrow="Contractor / Schedule"
      title="Schedule"
      description="Your assigned jobs by day, with the time windows the office set."
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous week">
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setFrom(startOfDay(new Date()));
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next week">
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <CalendarDays className="size-4 text-[var(--ct-accent)]" aria-hidden />
        {rangeLabel}
      </p>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {loading && !rows ? (
        <CenteredSpinner label="Loading schedule" />
      ) : (
        <div className={cn("flex flex-col gap-3", loading && "opacity-70")}>
          {days.map(({ date, rows: dayRows }) => {
            const key = dayKey(date);
            return (
              <section key={key} className="rounded-2xl border border-[var(--ct-border)] bg-white">
                <header className="flex items-center gap-2 border-b border-[var(--ct-divider)] px-4 py-2.5">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      key === todayKey ? "text-[var(--ct-accent)]" : "text-slate-900",
                    )}
                  >
                    {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                  {key === todayKey ? (
                    <span className="rounded-full bg-[var(--ct-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ct-accent)] uppercase">
                      Today
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-slate-500">
                    {dayRows.length ? `${dayRows.length} job${dayRows.length === 1 ? "" : "s"}` : "Nothing scheduled"}
                  </span>
                </header>
                {dayRows.length ? (
                  <ul className="divide-y divide-[var(--ct-divider)]">
                    {dayRows.map((row) => (
                      <li key={`${key}-${row.id}`}>
                        <Link href={contractorPaths.job(row.jobId)} className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className="inline-flex min-w-36 items-center gap-1.5 text-xs font-medium text-slate-700">
                            <Clock3 className="size-3.5 text-slate-400" aria-hidden />
                            {timeLabel(row)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {row.number}
                              {row.title ? <span className="font-normal text-slate-600"> · {row.title}</span> : null}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">{siteLine(row) || "Address not set"}</span>
                            </span>
                            {row.instructions ? (
                              <span className="mt-1 line-clamp-1 block text-xs text-slate-600">{row.instructions}</span>
                            ) : null}
                          </span>
                          <JobStatusPill status={row.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </PortalPage>
  );
}
