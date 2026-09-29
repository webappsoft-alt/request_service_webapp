"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreateJobDialog } from "@/components/portal/create-work-dialogs";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import {
  BoardCard,
  DashboardSection,
  DateStamp,
  StatCell,
  dashboardGreeting,
} from "@/components/portal/dashboard-widgets";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  crmTaskPriorityLabel,
  type CrmTaskPriority,
} from "@/lib/data/crm-people";
import { formatClock, jobStatusTone } from "@/lib/data/portal";
import type { JobStatus, RequestStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProviderDashboard } from "@/store/dashboardSlice";
import { selectAuthUser } from "@/store/authSlice";

type ServiceScale = "month" | "year";

const DONUT_COLORS = ["#003F7D", "#3d6b9a", "#5b8fa8", "#8aa8bc", "#c5d2dc", "#dce3ea"];
const RING = 2 * Math.PI * 54;

export function ServiceDashboardView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.dashboard);
  const user = useAppSelector(selectAuthUser);
  const [scale, setScale] = useState<ServiceScale>("month");
  const [jobOpen, setJobOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    void dispatch(fetchProviderDashboard({ force: false, silent: true }));
  }, [dispatch]);

  useEffect(() => {
    if (!error || loading) return;
    toast.error(error);
  }, [error, loading]);

  const attention = data?.attention;
  const jobs = data?.jobs;
  const schedule = data?.schedule;
  const tasks = data?.tasks;
  const leads = data?.leads;

  const points = data?.jobsChart?.[scale] ?? [];
  const openedTotal = points.reduce((sum, item) => sum + item.opened, 0);
  const finishedTotal = points.reduce((sum, item) => sum + item.finished, 0);
  const maxBar = Math.max(...points.map((item) => Math.max(item.opened, item.finished)), 1);
  const statusMix = jobs?.byServiceGroup ?? [];
  const overdueTasks = attention?.overdueTasks ?? tasks?.overdueCount ?? 0;
  const showLoading = loading && !data;

  return (
    <PortalPage
      eyebrow="Service"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · Jobs, schedule, and the work still open`}
      actions={<DashboardSwitcher />}
    >
      <div className={cn(showLoading && "opacity-60")}>
        <DashboardSection
          title="Jobs needing action"
          description="Unscheduled, unassigned, in the field, or held up."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCell
              label="Unscheduled jobs"
              value={String(jobs?.unscheduled ?? 0)}
              note="Need a date on the board"
              href="/pro/dashboard/jobs?status=unscheduled"
            />
            <StatCell
              label="Jobs with no team member"
              value={String(attention?.unassignedActiveJobs ?? 0)}
              note="Active jobs still unassigned"
              href="/pro/dashboard/schedule"
            />
            <StatCell
              label="In the field"
              value={String(jobs?.inField ?? 0)}
              note="Dispatched, en route, or on site"
              href="/pro/dashboard/jobs?status=in_progress"
            />
            <StatCell
              label="Held up"
              value={String(jobs?.heldUp ?? 0)}
              note={`${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}`}
              href="/pro/dashboard/jobs?status=on_hold"
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Jobs overview" description="Opened vs finished and status mix.">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <Card className="border-input">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {scale === "year" ? "Jobs by year" : "Jobs by month"}
                  </CardTitle>
                  <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                    {openedTotal}
                  </p>
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
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))`,
                  }}
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

            <Card className="border-input">
              <CardHeader className="gap-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Jobs by status
                </CardTitle>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {jobs?.total ?? 0}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <StatusMixChart rows={statusMix} total={jobs?.total ?? 0} />
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

          <BoardCard title="Active jobs" href="/pro/dashboard/jobs" hrefLabel="All jobs">
            {(jobs?.latestActive ?? []).map((job) => (
              <Link
                key={job.id}
                href={`/pro/dashboard/jobs/${job.id}`}
                className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
              >
                <DateStamp value={job.scheduledAt ?? undefined} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {job.number}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {job.customerName}
                      </span>
                    </p>
                    <StatusPill
                      label={job.statusLabel}
                      className={jobStatusTone(job.status as JobStatus)}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {job.detail || job.city}
                    {job.assignee ? ` · ${job.assignee}` : " · Unassigned"}
                  </p>
                </div>
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <DashboardSection title="Schedule" description="This week’s blocks and calendar.">
          <Card className="border-input">
            <CardHeader className="gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>This week</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {schedule?.upcomingWeekCount ?? 0} scheduled block
                  {(schedule?.upcomingWeekCount ?? 0) === 1 ? "" : "s"} · {schedule?.todayCount ?? 0}{" "}
                  today
                </p>
              </div>
              <Link
                href="/pro/dashboard/schedule"
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Open calendar
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {(schedule?.weekDays ?? []).map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center",
                      day.date === todayKey ? "border-primary bg-secondary" : "border-input",
                    )}
                  >
                    <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {day.label}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">{day.day}</p>
                    <p className="text-[11px] text-muted-foreground">{day.count || "—"}</p>
                  </div>
                ))}
              </div>
              {(schedule?.weekEvents.length ?? 0) ? (
                <ul className="divide-y divide-border">
                  {(schedule?.weekEvents ?? []).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3.5 py-3 hover:text-primary"
                      >
                        <DateStamp value={item.date} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.startMinutes != null ? formatClock(item.startMinutes) : "All day"}
                            {" · "}
                            {item.detail}
                            {item.employeeName ? ` · ${item.employeeName}` : ""}
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
        </DashboardSection>

        <DashboardSection title="Tasks" description="Open work due soon.">
          <BoardCard
            title="My day"
            href="/pro/dashboard/tasks"
            hrefLabel="All tasks"
            empty={(tasks?.myDay.length ?? 0) ? undefined : "No open tasks due soon."}
          >
            {(tasks?.myDay ?? []).map((task) => (
              <Link
                key={task.id}
                href={`/pro/dashboard/tasks/${task.id}`}
                className="flex items-start gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    task.isOverdue ? "bg-red-500" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p
                      className={cn(
                        "shrink-0 text-xs",
                        task.isOverdue ? "font-medium text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {formatDate(task.dueAt)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {crmTaskPriorityLabel((task.priority as CrmTaskPriority) || "normal")}
                  </p>
                </div>
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <DashboardSection title="Leads" description="Open leads ready for the field.">
          <BoardCard
            title="Open leads for the field"
            href="/pro/dashboard/requests"
            hrefLabel="All leads"
          >
            {(leads?.field ?? []).map((request) => (
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
                <StatusPill
                  label={request.statusLabel}
                  tone={requestTone(request.status as RequestStatus)}
                />
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <section className="rounded-xl border border-input bg-card px-5 py-5">
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
      </div>

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

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
