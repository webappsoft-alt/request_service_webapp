"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Briefcase, CalendarDays, Clock3, FileText } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import {
  ClockControl,
  EmptyNote,
  JobStatusPill,
  LocationBlock,
  customerName,
} from "@/components/technician/tech-ui";
import { LiveTimer, TimeStat } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { formatClock } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { formatDuration, formatHours } from "@/lib/time-tracking";
import { selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechDashboard } from "@/store/technicianSlice";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TechnicianDashboardView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const { data, loading, error } = useAppSelector((state) => state.technician.dashboard);
  const version = useAppSelector((state) => state.technician.versions.dashboard);
  const timeVersion = useAppSelector((state) => state.timeTracking.version);
  const active = useAppSelector((state) => state.timeTracking.active);
  const unread = useAppSelector((state) => state.technician.notifications.unread);

  useEffect(() => {
    void dispatch(fetchTechDashboard());
  }, [dispatch, version, timeVersion]);

  const firstName = typeof user?.firstName === "string" ? user.firstName : "";

  if (!data && loading) {
    return (
      <div className="rounded-md border border-border-soft bg-card">
        <CenteredSpinner label="Loading your day" className="min-h-[22rem]" />
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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <PortalPage
      eyebrow={today}
      title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
      description="Your jobs, visits, and hours for today. Everything here is assigned to you."
      actions={
        <Button size="sm" className="h-8" asChild>
          <Link href={technicianPaths.schedule}>Open schedule</Link>
        </Button>
      }
    >
      {/* Current / active job */}
      {active ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-800 uppercase">Currently clocked in</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {active.job
                ? `${active.job.number || "Job"}${active.job.title ? ` · ${active.job.title}` : ""}`
                : `${active.estimate?.number || "Estimate"}${active.estimate?.title ? ` · ${active.estimate.title}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveTimer entry={active} className="text-2xl font-semibold text-emerald-800" />
            <Button size="sm" className="h-8" asChild>
              <Link href={active.job ? technicianPaths.job(active.job.id) : active.estimate ? technicianPaths.estimate(active.estimate.id) : technicianPaths.time}>
                Open
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <TimeStat label="Hours today" value={formatHours(data.time.today.totalSeconds)} hint={formatDuration(data.time.today.totalSeconds)} accent />
        <TimeStat label="This week" value={formatHours(data.time.week.totalSeconds)} hint={`${data.time.week.sessions} sessions`} />
        <TimeStat label="This month" value={formatHours(data.time.month.totalSeconds)} hint={`${formatMoney(data.time.month.totalPay)} earned`} />
        <TimeStat label="Open jobs" value={data.counts.openJobs} hint={`${data.counts.completedJobs} completed`} />
        <TimeStat label="Estimates" value={data.counts.estimates} hint="Assigned visits" />
        <TimeStat label="Visits today" value={data.counts.todayVisits} hint={`Pay rate ${formatMoney(data.payRate)}/hr`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Today's schedule */}
        <section className="rounded-md border border-border-soft bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden /> Today&apos;s schedule
            </h2>
            <Link href={technicianPaths.schedule} className="text-xs font-medium text-primary hover:underline">
              Full schedule
            </Link>
          </header>
          <div className="divide-y divide-border-soft">
            {data.todaySchedule.length ? (
              data.todaySchedule.map((row) => {
                const href =
                  row.kind === "job" && row.recordId
                    ? technicianPaths.job(row.recordId)
                    : row.kind === "estimate" && row.recordId
                      ? technicianPaths.estimate(row.recordId)
                      : technicianPaths.schedule;
                return (
                  <Link key={row.id} href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <div className="w-24 shrink-0 text-xs font-semibold text-[#003F7D] tabular-nums">
                      {formatClock(row.startMinutes)}–{formatClock(row.endMinutes)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.kind === "estimate" ? "Estimate visit" : "Job"} · {customerName(row.customer)}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                );
              })
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nothing on your calendar today.</p>
            )}
          </div>
        </section>

        {/* Actions / notifications */}
        <section className="rounded-md border border-border-soft bg-card">
          <header className="flex items-center gap-2 border-b border-border-soft px-4 py-2.5">
            <Bell className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Needs your attention</h2>
          </header>
          <ul className="space-y-2 p-4 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Unread notifications</span>
              <span className="font-semibold tabular-nums">{unread}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Jobs scheduled today</span>
              <span className="font-semibold tabular-nums">{data.todayJobs.length}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Running timer</span>
              <span className="font-semibold">{active ? "Yes" : "No"}</span>
            </li>
            {!active && data.todayJobs[0] ? (
              <li className="pt-2">
                <ClockControl target={{ kind: "job", id: data.todayJobs[0].id }} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Next up: {data.todayJobs[0].number}
                  {data.todayJobs[0].title ? ` · ${data.todayJobs[0].title}` : ""}
                </p>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <JobList title="Today's jobs" icon={<Clock3 className="size-4 text-muted-foreground" aria-hidden />} jobs={data.todayJobs} empty="No jobs scheduled for today." />
        <JobList title="Assigned jobs" icon={<Briefcase className="size-4 text-muted-foreground" aria-hidden />} jobs={data.upcomingJobs} empty="No open jobs assigned to you." viewAll />
      </div>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-soft bg-card px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          You have <span className="font-semibold">{data.counts.estimates}</span> estimate visit{data.counts.estimates === 1 ? "" : "s"} assigned.
        </p>
        <Button size="sm" variant="outline" className="h-8" asChild>
          <Link href={technicianPaths.estimates}>View estimates</Link>
        </Button>
      </section>
    </PortalPage>
  );
}

function JobList({
  title,
  icon,
  jobs,
  empty,
  viewAll,
}: {
  title: string;
  icon: React.ReactNode;
  jobs: import("@/lib/api/technician-client").TechJobRow[];
  empty: string;
  viewAll?: boolean;
}) {
  return (
    <section className="rounded-md border border-border-soft bg-card">
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon} {title}
        </h2>
        {viewAll ? (
          <Link href={technicianPaths.jobs} className="text-xs font-medium text-primary hover:underline">
            All jobs
          </Link>
        ) : null}
      </header>
      <div className="divide-y divide-border-soft">
        {jobs.length ? (
          jobs.map((job) => (
            <div key={job.id} className="space-y-1.5 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Link href={technicianPaths.job(job.id)} className="min-w-0 truncate text-sm font-semibold text-primary hover:underline">
                  {job.number}
                  {job.title ? <span className="font-normal text-foreground"> · {job.title}</span> : null}
                </Link>
                <JobStatusPill status={job.status} />
              </div>
              <p className="text-xs text-muted-foreground">{customerName(job.customer, job.customerSnapshot)}</p>
              <LocationBlock location={job.location} compact />
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}
