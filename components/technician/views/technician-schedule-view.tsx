"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { DirectionsButton, customerName, directionsUrl } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { TechScheduleRow } from "@/lib/api/technician-client";
import { formatClock } from "@/lib/data/portal";
import { technicianPaths } from "@/lib/technician-paths";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechSchedule, markTechSectionRead } from "@/store/technicianSlice";

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Rows that fall on `day` (multi-day rows show on each day they span). */
function rowsForDay(rows: TechScheduleRow[], day: Date) {
  const start = new Date(day);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return rows
    .filter((row) => {
      const from = new Date(row.date);
      const to = row.endDate ? new Date(row.endDate) : from;
      return from <= end && to >= start;
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function TechnicianScheduleView() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.technician.schedule);
  const version = useAppSelector((state) => state.technician.versions.schedule);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const range = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startDate: weekStart.toISOString(), endDate: end.toISOString() };
  }, [weekStart]);

  useEffect(() => {
    void dispatch(markTechSectionRead("schedule"));
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchTechSchedule({ ...range, force: version > 0 }));
  }, [dispatch, range, version]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const todayKey = dayKey(new Date());
  const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function shift(weeks: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + weeks * 7);
      return next;
    });
  }

  return (
    <PortalPage
      eyebrow="Technician / Schedule"
      title="My schedule"
      description="Only visits booked for you. Tap a visit to open the job or estimate."
      actions={
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" aria-label="Previous week" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Next week" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{weekLabel}</p>
        {loading ? <Spinner className="size-4" /> : null}
      </div>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="space-y-2">
        {days.map((day) => {
          const rows = rowsForDay(items, day);
          const isToday = dayKey(day) === todayKey;
          return (
            <section
              key={dayKey(day)}
              className={cn("rounded-md border border-border-soft bg-card", isToday && "border-[#003F7D]/40 shadow-[inset_3px_0_0_#003F7D]")}
            >
              <header className="flex items-center justify-between border-b border-border-soft px-4 py-2">
                <h2 className="text-sm font-semibold">
                  {day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  {isToday ? <span className="ml-2 text-xs font-medium text-[#003F7D]">Today</span> : null}
                </h2>
                <span className="text-xs text-muted-foreground">{rows.length ? `${rows.length} visit${rows.length === 1 ? "" : "s"}` : "Free"}</span>
              </header>
              {rows.length ? (
                <ul className="divide-y divide-border-soft">
                  {rows.map((row) => {
                    const href =
                      row.kind === "job" && row.recordId
                        ? technicianPaths.job(row.recordId)
                        : row.kind === "estimate" && row.recordId
                          ? technicianPaths.estimate(row.recordId)
                          : null;
                    const url = directionsUrl(row.record?.location);
                    const body = (
                      <>
                        <span className="w-28 shrink-0 text-xs font-semibold text-[#003F7D] tabular-nums">
                          {formatClock(row.startMinutes)}–{formatClock(row.endMinutes)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {row.record?.number ? `${row.record.number} · ` : ""}
                            {row.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.kind === "estimate" ? "Estimate visit" : row.kind === "job" ? "Job" : row.kind} · {customerName(row.customer)} ·{" "}
                            {row.status.replace(/_/g, " ")}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={`${row.id}-${dayKey(day)}`} className="flex items-center gap-2 px-4 py-2.5">
                        {href ? (
                          <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary">
                            {body}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
                        )}
                        {url ? <DirectionsButton url={url} compact /> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </PortalPage>
  );
}
