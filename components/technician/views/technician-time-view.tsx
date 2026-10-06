"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { DetailCard } from "@/components/technician/tech-ui";
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import { TimeByDayTable, TimeSummaryCards } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { resolveTimeRange } from "@/lib/time-tracking";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTimeEntries, selectTimeList } from "@/store/timeTrackingSlice";

function monthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Monthly totals: hours, jobs, estimates, sessions, earnings, and a daily breakdown. */
function MonthlySummary({ payRate }: { payRate: number }) {
  const dispatch = useAppDispatch();
  const [month, setMonth] = useState(() => monthInput(new Date()));
  const list = useAppSelector((state) => selectTimeList(state, "tech:month"));
  const version = useAppSelector((state) => state.timeTracking.version);
  const range = useMemo(() => resolveTimeRange({ preset: "month", fromDate: month }), [month]);

  useEffect(() => {
    // Only totals are needed here — the session list below pages separately.
    void dispatch(
      fetchTimeEntries({
        scopeKey: "tech:month",
        query: { from: range.from, to: range.to, page: 1, limit: 1 },
        technician: true,
        force: version > 0,
      }),
    );
  }, [dispatch, range.from, range.to, version]);

  function shift(months: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthInput(new Date(y, m - 1 + months, 1)));
  }

  const isCurrent = month === monthInput(new Date());

  return (
    <DetailCard
      title={`Monthly summary · ${range.label}`}
      action={
        <div className="flex items-center gap-1">
          {list.loading ? <Spinner className="mr-1 size-3.5" /> : null}
          <Button size="icon-xs" variant="outline" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button size="icon-xs" variant="outline" aria-label="Next month" disabled={isCurrent} onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <TimeSummaryCards summary={list.summary} payRate={payRate} />
        <p className="text-xs text-muted-foreground">
          Earnings are your tracked hours × the pay rate saved on each session ({formatMoney(payRate)}/hr currently).
        </p>
        {list.summary.byDay.length ? (
          <TimeByDayTable rows={list.summary.byDay} />
        ) : (
          <p className="text-sm text-muted-foreground">No time tracked in {range.label}.</p>
        )}
      </div>
    </DetailCard>
  );
}

export function TechnicianTimeView() {
  const payRate = useAppSelector((state) => Number(state.technician.profile.data?.employee?.hourlyRate) || 0);

  return (
    <PortalPage
      eyebrow="Technician / Time tracking"
      title="Time tracking"
      description="Every clock-in and clock-out you've recorded, with hours, jobs, estimates, and pay."
    >
      <MonthlySummary payRate={payRate} />
      <DetailCard title="Session history">
        <TimeTrackingPanel
          scopeKey="tech"
          technician
          defaultRange={{ preset: "week" }}
          payRate={payRate}
          showByDay={false}
          hrefFor={(kind, id) => (kind === "job" ? technicianPaths.job(id) : technicianPaths.estimate(id))}
        />
      </DetailCard>
    </PortalPage>
  );
}
