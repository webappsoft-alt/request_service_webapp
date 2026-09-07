"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CreateJobDialog } from "@/components/portal/create-work-dialogs";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import { BoardCard, DateStamp, StatCell, dashboardGreeting } from "@/components/portal/dashboard-widgets";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmTaskPriorityLabel, taskIsOpen, taskIsOverdue } from "@/lib/data/crm-people";
import { formatClock, getPortalCustomerName, jobStatusLabel, jobStatusTone, requestStatusLabel } from "@/lib/data/portal";
import type { Job, JobStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ServiceScale = "month" | "year";

const DONUT_COLORS = ["#003F7D", "#3d6b9a", "#5b8fa8", "#8aa8bc", "#c5d2dc", "#dce3ea"];
const RING = 2 * Math.PI * 54;

function jobIsActive(job: Job) {
  return job.status !== "completed" && job.status !== "invoiced" && job.status !== "paid" && job.status !== "cancelled";
}

function jobInField(status: JobStatus) {
  switch (status) {
    case "dispatched":
    case "en_route":
    case "on_site":
    case "in_progress":
      return true;
    case "unscheduled":
    case "scheduled":
    case "on_hold":
    case "waiting_parts":
    case "needs_return":
    case "completed":
    case "invoiced":
    case "paid":
    case "cancelled":
      return false;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function jobHeldUp(status: JobStatus) {
  switch (status) {
    case "on_hold":
    case "waiting_parts":
    case "needs_return":
      return true;
    case "unscheduled":
    case "scheduled":
    case "dispatched":
    case "en_route":
    case "on_site":
    case "in_progress":
    case "completed":
    case "invoiced":
    case "paid":
    case "cancelled":
      return false;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function serviceStatusGroup(status: JobStatus) {
  switch (status) {
    case "unscheduled":
      return "Unscheduled";
    case "scheduled":
      return "Scheduled";
    case "dispatched":
    case "en_route":
    case "on_site":
    case "in_progress":
      return "In the field";
    case "on_hold":
    case "waiting_parts":
    case "needs_return":
      return "Held up";
    case "completed":
      return "Completed";
    case "invoiced":
    case "paid":
      return "Billed";
    case "cancelled":
      return "Cancelled";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function monthBuckets(today: Date, count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });
}

function yearBuckets(today: Date, count = 4) {
  return Array.from({ length: count }, (_, index) => {
    const year = today.getFullYear() - (count - 1 - index);
    return { key: String(year), label: String(year) };
  });
}

function bucketKey(value: string, scale: ServiceScale) {
  return scale === "year" ? value.slice(0, 4) : value.slice(0, 7);
}

export function ServiceDashboardView() {
  const { provider, jobs, requests } = usePortalWorkspace();
  const { tasks } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const [scale, setScale] = useState<ServiceScale>("month");
  const [jobOpen, setJobOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayKey = today.toISOString().slice(0, 10);
  const firstName = provider.contact?.name?.split(" ")[0] ?? "there";

  const allJobs = records.listed("job", records.mergeJobs(jobs), false);
  const allRequests = records.listed("request", records.mergeRequests(requests), false);
  const allTasks = records.listed("task", tasks, false);
  const activeJobs = allJobs.filter(jobIsActive);
  const unscheduled = allJobs.filter((job) => job.status === "unscheduled");
  const unassigned = activeJobs.filter((job) => {
    const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
    return !job.assignedTo && !event?.employeeId;
  });
  const inField = allJobs.filter((job) => jobInField(job.status));
  const heldUp = allJobs.filter((job) => jobHeldUp(job.status));
  const overdueTasks = allTasks.filter((item) => taskIsOverdue(item, todayKey));
  const weekEvents = events
    .filter((item) => item.date && item.date >= todayKey && item.date <= addDays(todayKey, 6) && item.kind !== "invoice")
    .sort((a, b) => `${a.date}-${a.startMinutes ?? 0}`.localeCompare(`${b.date}-${b.startMinutes ?? 0}`));
  const todayEvents = weekEvents.filter((item) => item.date === todayKey);
  const myDay = allTasks
    .filter((item) => taskIsOpen(item) && (taskIsOverdue(item, todayKey) || item.dueAt <= addDays(todayKey, 7)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 6);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(todayKey, index);
    return {
      key,
      label: new Date(`${key}T12:00:00`).toLocaleString("en-US", { weekday: "short" }),
      day: new Date(`${key}T12:00:00`).getDate(),
      count: weekEvents.filter((item) => item.date === key).length,
    };
  });

  const points = useMemo(() => {
    const buckets = scale === "year" ? yearBuckets(today) : monthBuckets(today);
    return buckets.map((bucket) => ({
      ...bucket,
      opened: allJobs.filter((item) => bucketKey(item.createdAt, scale) === bucket.key).length,
      finished: allJobs.filter(
        (item) =>
          (item.status === "completed" || item.status === "invoiced" || item.status === "paid") &&
          bucketKey(item.updatedAt, scale) === bucket.key,
      ).length,
    }));
  }, [allJobs, month, scale, year]);

  const openedTotal = points.reduce((sum, item) => sum + item.opened, 0);
  const finishedTotal = points.reduce((sum, item) => sum + item.finished, 0);
  const maxBar = Math.max(...points.map((item) => Math.max(item.opened, item.finished)), 1);

  const statusMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of allJobs) {
      const label = serviceStatusGroup(job.status);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [allJobs]);

  return (
    <PortalPage
      eyebrow="Service"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · Jobs, schedule, and the work still open`}
      actions={<DashboardSwitcher />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Unscheduled jobs"
          value={String(unscheduled.length)}
          note="Need a date on the board"
          href="/pro/dashboard/jobs?status=unscheduled"
        />
        <StatCell
          label="Jobs with no technician"
          value={String(unassigned.length)}
          note="Active jobs still unassigned"
          href="/pro/dashboard/schedule"
        />
        <StatCell
          label="In the field"
          value={String(inField.length)}
          note="Dispatched, en route, or on site"
          href="/pro/dashboard/jobs?status=in_progress"
        />
        <StatCell
          label="Held up"
          value={String(heldUp.length)}
          note={`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`}
          href="/pro/dashboard/jobs?status=on_hold"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="border-border">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {scale === "year" ? "Jobs by year" : "Jobs by month"}
              </CardTitle>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{openedTotal}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Opened · {finishedTotal} finished
              </p>
            </div>
            <LocalFilterTabs
              value={scale}
              onChange={(next) => setScale(next as ServiceScale)}
              options={[
                { value: "month", label: "Monthly" },
                { value: "year", label: "Yearly" },
              ]}
            />
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary/20" />
                Opened
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" />
                Finished
              </span>
            </div>
            <div
              className="grid items-end gap-3"
              style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
            >
              {points.map((point) => (
                <div key={point.key} className="flex flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/2 rounded-sm bg-primary/15"
                      style={{ height: `${Math.max(4, (point.opened / maxBar) * 144)}px` }}
                      title={`${point.opened} opened`}
                    />
                    <div
                      className="w-1/2 rounded-sm bg-primary"
                      style={{ height: `${Math.max(4, (point.finished / maxBar) * 144)}px` }}
                      title={`${point.finished} finished`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs by status</CardTitle>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{allJobs.length}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <StatusMixChart rows={statusMix} total={allJobs.length} />
            <ul className="space-y-2 text-sm">
              {statusMix.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>This week</CardTitle>
            <p className="text-sm text-muted-foreground">
              {weekEvents.length} scheduled block{weekEvents.length === 1 ? "" : "s"} · {todayEvents.length} today
            </p>
          </div>
          <Link href="/pro/dashboard/schedule" className="text-sm font-medium text-primary hover:text-primary/80">
            Open calendar
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div
                key={day.key}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center",
                  day.key === todayKey ? "border-primary bg-secondary" : "border-border",
                )}
              >
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{day.label}</p>
                <p className="text-sm font-semibold tabular-nums">{day.day}</p>
                <p className="text-[11px] text-muted-foreground">{day.count || "—"}</p>
              </div>
            ))}
          </div>
          {weekEvents.length ? (
            <ul className="divide-y divide-border">
              {weekEvents.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center gap-3.5 py-3 hover:text-primary">
                    <DateStamp value={item.date} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.startMinutes != null ? formatClock(item.startMinutes) : "All day"}
                        {" · "}
                        {item.detail}
                        {item.employeeId ? ` · ${employeeLabel(item.employeeId)}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled this week.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BoardCard title="My day" href="/pro/dashboard/tasks" hrefLabel="All tasks" empty={myDay.length ? undefined : "No open tasks due soon."}>
          {myDay.map((task) => (
            <Link
              key={task.id}
              href={`/pro/dashboard/tasks/${task.id}`}
              className="flex items-start gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", taskIsOverdue(task, todayKey) ? "bg-red-500" : "bg-primary")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className={cn("shrink-0 text-xs", taskIsOverdue(task, todayKey) ? "font-medium text-red-600" : "text-muted-foreground")}>
                    {formatDate(task.dueAt)}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">{crmTaskPriorityLabel(task.priority)}</p>
              </div>
            </Link>
          ))}
        </BoardCard>

        <BoardCard title="Active jobs" href="/pro/dashboard/jobs" hrefLabel="All jobs">
          {activeJobs.slice(0, 6).map((job) => {
            const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
            return (
              <Link
                key={job.id}
                href={`/pro/dashboard/jobs/${job.id}`}
                className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
              >
                <DateStamp value={event?.date ?? job.scheduledAt} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {job.number}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {getPortalCustomerName(provider, job.customerId)}
                      </span>
                    </p>
                    <StatusPill label={jobStatusLabel(job.status)} className={jobStatusTone(job.status)} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {event?.detail ?? job.address.city}
                    {event?.employeeId ? ` · ${employeeLabel(event.employeeId)}` : job.assignedTo ? ` · ${job.assignedTo}` : " · Unassigned"}
                  </p>
                </div>
              </Link>
            );
          })}
        </BoardCard>
      </div>

      <BoardCard title="Open leads for the field" href="/pro/dashboard/requests" hrefLabel="All leads">
        {allRequests
          .filter((item) => item.status === "new" || item.status === "contacted" || item.status === "accepted")
          .slice(0, 4)
          .map((request) => (
            <Link
              key={request.id}
              href={`/pro/dashboard/requests/${request.id}`}
              className="flex items-center justify-between gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{request.serviceName}</p>
                <p className="text-xs text-muted-foreground">
                  {request.customerName} · {request.neighborhood}
                </p>
              </div>
              <StatusPill label={requestStatusLabel(request.status)} tone={requestTone(request.status)} />
            </Link>
          ))}
      </BoardCard>

      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <h2 className="text-sm font-semibold">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setJobOpen(true)}>
            Create job
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
            Create task
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pro/dashboard/schedule">Open schedule</Link>
          </Button>
        </div>
      </section>

      <CreateJobDialog open={jobOpen} onOpenChange={setJobOpen} />
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </PortalPage>
  );
}

function StatusMixChart({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  let offset = 0;
  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e6ebf0" strokeWidth="16" />
        {rows.map((row, index) => {
          const share = total ? row.value / total : 0;
          const dash = RING * share;
          const circle = (
            <circle
              key={row.label}
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${RING - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Jobs</p>
        <p className="text-lg font-semibold tabular-nums">{total}</p>
      </div>
    </div>
  );
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
