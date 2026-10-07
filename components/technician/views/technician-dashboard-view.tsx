"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { DashPanel, FeedPanel, MetricTile } from "@/components/portal/dashboard-charts";
import { ActionPanel, TodayWorkCard } from "@/components/portal/dashboard-action-center";
import { dashboardGreeting, initials } from "@/components/portal/dashboard-widgets";
import { PortalPage } from "@/components/portal/portal-page";
import {
  ClockControl,
  DirectionsButton,
  EmptyNote,
  JobStatusPill,
  addressLine,
  customerName,
  directionsUrl,
} from "@/components/technician/tech-ui";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { TechJobRow, TechScheduleRow } from "@/lib/api/technician-client";
import { formatClock } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { formatDuration, formatHours } from "@/lib/time-tracking";
import { cn } from "@/lib/utils";
import { selectAuthUser } from "@/store/authSlice";
import type { DashboardActionItem } from "@/store/dashboardSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechDashboard } from "@/store/technicianSlice";
import { fetchLedger, selectLedger } from "@/store/timeTrackingSlice";

const LEDGER_QUERY = { technician: true } as const;

function scheduleHref(row: TechScheduleRow) {
  if (row.kind === "job" && row.recordId) return technicianPaths.job(row.recordId);
  if (row.kind === "estimate" && row.recordId) return technicianPaths.estimate(row.recordId);
  return technicianPaths.schedule;
}

/** Map a technician calendar row onto the Pro "Today's work" card shape. */
function toTodayItem(row: TechScheduleRow): DashboardActionItem {
  const isVisit = row.kind === "estimate" || row.kind === "visit";
  return {
    id: row.id,
    kind: isVisit ? "estimate" : "job",
    actionLabel: isVisit ? "Estimate visit" : "Job",
    title: row.title,
    customerName: customerName(row.customer),
    reference: row.record?.number || "",
    status: row.status,
    statusLabel: "",
    detail: `${formatClock(row.startMinutes)}–${formatClock(row.endMinutes)}`,
    time: formatClock(row.startMinutes),
    href: scheduleHref(row),
  };
}

export function TechnicianDashboardView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const { data, loading, error } = useAppSelector((state) => state.technician.dashboard);
  const version = useAppSelector((state) => state.technician.versions.dashboard);
  const timeVersion = useAppSelector((state) => state.timeTracking.version);
  const active = useAppSelector((state) => state.timeTracking.active);
  const unread = useAppSelector((state) => state.technician.notifications.unread);
  const paymentVersion = useAppSelector((state) => state.timeTracking.paymentVersion);
  const pay = useAppSelector((state) => selectLedger(state, "tech")).data.summary;

  useEffect(() => {
    void dispatch(fetchTechDashboard());
  }, [dispatch, version, timeVersion]);

  useEffect(() => {
    void dispatch(fetchLedger({ scopeKey: "tech", query: LEDGER_QUERY, force: timeVersion + paymentVersion > 0 }));
  }, [dispatch, timeVersion, paymentVersion]);

  const firstName = typeof user?.firstName === "string" ? user.firstName : "";

  if (!data && loading) {
    return (
      <div className="rounded-xl border border-input bg-card">
        <CenteredSpinner label="Loading your day" className="min-h-88" />
      </div>
    );
  }

  if (!data) {
    return (
      <PortalPage eyebrow="Technician" title="Dashboard">
        <EmptyNote>{error || "Could not load your dashboard."}</EmptyNote>
      </PortalPage>
    );
  }

  const now = new Date();
  const longDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const schedule = [...data.todaySchedule].sort((a, b) => a.startMinutes - b.startMinutes);
  const nextId = schedule.find((row) => row.startMinutes > nowMinutes)?.id;
  const nextJob = data.todayJobs[0];

  const numbers = [
    { label: "Hours today", value: formatHours(data.time.today.totalSeconds), note: formatDuration(data.time.today.totalSeconds), href: technicianPaths.time, hot: false },
    { label: "This week", value: formatHours(data.time.week.totalSeconds), note: `${data.time.week.sessions} sessions`, href: technicianPaths.time, hot: false },
    { label: "This month", value: formatHours(data.time.month.totalSeconds), note: `${formatMoney(data.time.month.totalPay)} earned`, href: technicianPaths.payments, hot: false },
    { label: "Open jobs", value: String(data.counts.openJobs), note: `${data.counts.completedJobs} completed`, href: technicianPaths.jobs, hot: data.counts.openJobs > 0 },
    { label: "Estimates", value: String(data.counts.estimates), note: "Assigned visits", href: technicianPaths.estimates, hot: false },
    { label: "Visits today", value: String(data.counts.todayVisits), note: `Pay rate ${formatMoney(data.payRate)}/hr`, href: technicianPaths.schedule, hot: data.counts.todayVisits > 0 },
  ];

  return (
    <PortalPage
      eyebrow="Technician"
      title={`${dashboardGreeting(now)}${firstName ? `, ${firstName}` : ""}`}
      description={`${longDate} · Your jobs, visits, and hours. Everything here is assigned to you.`}
      actions={
        <Button size="sm" className="h-8" asChild>
          <Link href={technicianPaths.schedule}>Open schedule</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {active ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-800 uppercase">Currently clocked in</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {active.job
                  ? `${active.job.number || "Job"}${active.job.title ? ` · ${active.job.title}` : ""}`
                  : `${active.estimate?.number || "Estimate"}${active.estimate?.title ? ` · ${active.estimate.title}` : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LiveTimer entry={active} className="text-2xl font-semibold text-emerald-800 tabular-nums" />
              <Button size="sm" className="h-8" asChild>
                <Link
                  href={
                    active.job
                      ? technicianPaths.job(active.job.id)
                      : active.estimate
                        ? technicianPaths.estimate(active.estimate.id)
                        : technicianPaths.time
                  }
                >
                  Open
                </Link>
              </Button>
            </div>
          </section>
        ) : null}

        {/* My numbers — same divided strip as the Pro "Needs attention" bar */}
        <section className="overflow-hidden rounded-xl border border-input/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-input/70 px-4 py-2.5">
            <h2 className="text-[13px] font-semibold tracking-tight">My work at a glance</h2>
            <p className="text-[11px] text-muted-foreground">Hours, jobs and visits</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-input/60 md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
            {numbers.map((item) => (
              <Link key={item.label} href={item.href} className="px-4 py-3 transition-colors hover:bg-muted/40">
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{item.label}</p>
                <p className={cn("mt-1 text-xl font-semibold tracking-tight tabular-nums", item.hot && "text-[#003F7D]")}>
                  {item.value}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.note}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Today's schedule + clock / pay */}
        <div className="grid gap-3 xl:grid-cols-12">
          <ActionPanel
            tone="today"
            icon={
              <span className="relative flex size-5 items-center justify-center">
                {schedule.length ? <span className="tech-today-ping" aria-hidden /> : null}
                <CalendarClock className="relative size-4" aria-hidden />
              </span>
            }
            title="Today's schedule"
            className={cn("xl:col-span-7", schedule.length > 0 && "tech-today-glow")}
            meta={
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                  {schedule.length ? (
                    <span className="action-urgent-blink size-1.5 rounded-full bg-white" aria-hidden />
                  ) : null}
                  {schedule.length} today
                </span>
                <Link href={technicianPaths.schedule} className="text-[11px] font-medium text-white/85 hover:text-white">
                  Full schedule
                </Link>
              </div>
            }
          >
            {schedule.length ? (
              <ul className="grid max-h-106 gap-2 overflow-y-auto p-3">
                {schedule.map((row) => {
                  const running = row.startMinutes <= nowMinutes && nowMinutes < row.endMinutes;
                  return (
                    <TodayWorkCard
                      key={row.id}
                      item={toTodayItem(row)}
                      cta="Open"
                      highlight={running ? "now" : row.id === nextId ? "next" : undefined}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing on your calendar today.</p>
            )}
          </ActionPanel>

          <DashPanel
            title="Clock in & pay"
            href={technicianPaths.payments}
            hrefLabel="Payments"
            className="xl:col-span-5"
          >
            <div className="space-y-4">
              {!active && nextJob ? (
                <div className="space-y-1.5">
                  <ClockControl target={{ kind: "job", id: nextJob.id }} />
                  <p className="text-[11px] text-muted-foreground">
                    Next up:{" "}
                    <Link href={technicianPaths.job(nextJob.id)} className="font-medium text-primary hover:underline">
                      {nextJob.number}
                    </Link>
                    {nextJob.title ? ` · ${nextJob.title}` : ""}
                  </p>
                </div>
              ) : !active ? (
                <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  No job scheduled today — open a job to clock in.
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-1">
                <MetricTile label="Earned" value={formatMoney(pay.earned)} href={technicianPaths.payments} accent />
                <MetricTile label="Paid" value={formatMoney(pay.paid)} href={technicianPaths.payments} />
                <MetricTile
                  label="Remaining"
                  value={formatMoney(pay.remaining)}
                  note={pay.remaining > 0 ? "Owed to you" : "All settled"}
                  href={technicianPaths.payments}
                />
              </div>
              <div className="flex items-center justify-between border-t border-input/70 pt-3 text-xs">
                <span className="text-muted-foreground">Unread notifications</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold tabular-nums",
                    unread > 0 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground",
                  )}
                >
                  {unread}
                </span>
              </div>
            </div>
          </DashPanel>
        </div>

        {/* Job feeds */}
        <div className="grid gap-3 xl:grid-cols-2">
          <FeedPanel
            title="Today's jobs"
            href={technicianPaths.schedule}
            hrefLabel="Schedule"
            empty={data.todayJobs.length ? undefined : "No jobs scheduled for today."}
          >
            {data.todayJobs.map((job) => (
              <JobFeedRow key={job.id} job={job} />
            ))}
          </FeedPanel>
          <FeedPanel
            title="Assigned jobs"
            href={technicianPaths.jobs}
            hrefLabel="All jobs"
            empty={data.upcomingJobs.length ? undefined : "No open jobs assigned to you."}
          >
            {data.upcomingJobs.map((job) => (
              <JobFeedRow key={job.id} job={job} />
            ))}
          </FeedPanel>
        </div>
      </div>
    </PortalPage>
  );
}

/** Pro dashboard feed row (avatar · title · status · subline) plus a directions shortcut. */
function JobFeedRow({ job }: { job: TechJobRow }) {
  const name = customerName(job.customer, job.customerSnapshot);
  const address = addressLine(job.location);
  const url = directionsUrl(job.location);
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40">
      <Link href={technicianPaths.job(job.id)} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-medium">
              <span className="font-semibold text-primary">{job.number}</span>
              {job.title ? <span className="text-foreground"> · {job.title}</span> : null}
            </p>
            <JobStatusPill status={job.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            {name}
            {address ? (
              <>
                <span aria-hidden>·</span>
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{address}</span>
              </>
            ) : null}
          </p>
        </div>
      </Link>
      {url ? (
        <DirectionsButton
          url={url}
          compact
          target={{ recordType: "job", recordNumber: job.number, customerName: name, customerAddress: address }}
        />
      ) : null}
    </div>
  );
}
