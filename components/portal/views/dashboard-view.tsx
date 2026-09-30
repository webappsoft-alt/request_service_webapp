"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import { DashboardActionAlerts } from "@/components/portal/dashboard-action-alerts";
import {
  activityDot,
  AttentionStrip,
  BoardCard,
  BreakdownCard,
  DashboardSection,
  dashboardGreeting,
  DateStamp,
  initials,
  KpiStrip,
  PeriodBar,
  StatCell,
  type DashboardPeriod,
} from "@/components/portal/dashboard-widgets";
import { CreateEstimateDialog, CreateJobDialog, CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { PortalPage } from "@/components/portal/portal-page";
import { ProfileSetupChips, ProfileSetupSummary } from "@/components/portal/profile-setup-chips";
import { getProfileSetupItems, profileSetupProgress } from "@/lib/business-profile-setup";
import { selectAuthProvider, selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProviderDashboard } from "@/store/dashboardSlice";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  crmTaskPriorityLabel,
  reminderSubjectKindLabel,
  type CrmTaskPriority,
  type ReminderSubjectKind,
} from "@/lib/data/crm-people";
import { jobStatusTone } from "@/lib/data/portal";
import type { JobStatus, RequestStatus } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.dashboard);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const { officeHours } = usePortalSettings();
  const setupItems = getProfileSetupItems(user, authProvider, officeHours);
  const setup = profileSetupProgress(setupItems);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [leadOpen, setLeadOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  useEffect(() => {
    // Always load fresh Incoming requests (new quote leads) when opening Overview.
    void dispatch(fetchProviderDashboard({ force: true, silent: true }));
  }, [dispatch]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (detail?.type === "LEAD_CREATED" || detail?.type === "LEAD_UPDATED") {
        void dispatch(fetchProviderDashboard({ force: true, silent: true }));
      }
    };
    window.addEventListener("rs-realtime", onRealtime);
    return () => window.removeEventListener("rs-realtime", onRealtime);
  }, [dispatch]);

  useEffect(() => {
    if (!error || loading) return;
    toast.error(error);
  }, [error, loading]);

  const today = new Date();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const companyName = data?.companyName || "Your business";
  const city = data?.city || "";
  const state = data?.state || "";
  const attention = data?.attention;
  const leads = data?.leads;
  const messages = data?.messages;
  const estimates = data?.estimates;
  const jobs = data?.jobs;
  const schedule = data?.schedule;
  const invoices = data?.invoices;
  const payments = data?.payments;
  const people = data?.people;
  const tasks = data?.tasks;
  const reminders = data?.reminders;
  const activity = data?.activity ?? [];

  const periodTotals = payments?.period?.[period] ?? { revenue: 0, count: 0 };
  const revenue = payments?.revenueChart ?? [];
  const maxRevenue = Math.max(...revenue.map((point) => point.value), 1);
  const peopleRows = [
    { label: "Customers", value: people?.customers ?? 0, href: "/pro/dashboard/customers" },
    { label: "Employees", value: people?.employees ?? 0, href: "/pro/dashboard/employees" },
    { label: "Contractors", value: people?.contractors ?? 0, href: "/pro/dashboard/contractors" },
    { label: "Vendors", value: people?.vendors ?? 0, href: "/pro/dashboard/vendors" },
  ];
  const showLoading = loading && !data;
  const incomingLeads = (leads?.incoming ?? []).slice(0, 8);
  const inboxPreview = (messages?.inboxPreview ?? []).slice(0, 6);
  const upcomingJobs = (jobs?.upcoming ?? []).slice(0, 8);
  const upcomingSchedule = (schedule?.upcoming ?? []).slice(0, 8);
  const myDayTasks = (tasks?.myDay ?? []).slice(0, 8);
  const dueReminders = (reminders?.dueNext14Days ?? []).slice(0, 8);
  const recentActivity = activity.slice(0, 8);

  return (
    <PortalPage
      eyebrow="Overview"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · ${companyName}${city || state ? ` · ${[city, state].filter(Boolean).join(", ")}` : ""}`}
      actions={<DashboardSwitcher />}
    >
      <div className={cn("flex flex-col gap-4", showLoading && "opacity-60")}>
        <DashboardActionAlerts />
        {setup.percent < 100 ? (
          <Card className="border-input bg-primary/[0.03]">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Set up your business profile</CardTitle>
                <ProfileSetupSummary
                  done={setup.done}
                  total={setup.total}
                  percent={setup.percent}
                  nextLabel={setup.next?.label}
                />
              </div>
              <Button asChild>
                <Link href={setup.next?.href || "/pro/dashboard/profile"}>Complete setup</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${setup.percent}%` }} />
              </div>
              <ProfileSetupChips items={setupItems} />
            </CardContent>
          </Card>
        ) : null}

        <DashboardSection
          title="Needs attention"
          description="Urgent items that should be handled first."
        >
          <AttentionStrip
            items={[
              {
                label: "Overdue invoices",
                value: String(attention?.overdueInvoices.count ?? 0),
                note: `${formatMoney(attention?.overdueInvoices.amountPastDue ?? 0)} past due`,
                href: "/pro/dashboard/invoices?status=overdue",
              },
              {
                label: "Uninvoiced completed jobs",
                value: String(attention?.uninvoicedCompletedJobs ?? 0),
                note: "Finished work still waiting on an invoice",
                href: "/pro/dashboard/jobs?status=completed",
              },
              {
                label: "Jobs with no team member",
                value: String(attention?.unassignedActiveJobs ?? 0),
                note: "Active jobs still unassigned",
                href: "/pro/dashboard/jobs?status=unscheduled",
              },
              {
                label: "Overdue tasks",
                value: String(attention?.overdueTasks ?? 0),
                note: "Open work past its due date",
                href: "/pro/dashboard/tasks",
              },
            ]}
          />
        </DashboardSection>

        <PeriodBar value={period} onChange={setPeriod} />

        <DashboardSection
          title="Leads"
          description="Open pipeline from the website and CRM."
          action={
            <Link
              href="/pro/dashboard/requests"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              All leads
            </Link>
          }
        >
          <KpiStrip columns={2}>
            <StatCell
              embedded
              label="Open leads"
              value={String(Math.max(leads?.openCount ?? 0, leads?.newFromWebsite ?? 0))}
              note={`${leads?.newFromWebsite ?? 0} new from the website`}
              href="/pro/dashboard/requests?status=new,viewed"
            />
            <BreakdownCard
              embedded
              label="Leads by status"
              value={String(leads?.total ?? 0)}
              href="/pro/dashboard/requests"
              rows={leads?.byStatus ?? []}
            />
          </KpiStrip>
          <BoardCard
            embedded
            title="Incoming requests"
            href="/pro/dashboard/requests"
            hrefLabel="View all"
            empty={incomingLeads.length ? undefined : "No incoming leads yet."}
          >
            {incomingLeads.map((request) => (
              <Link
                key={request.id}
                href={`/pro/dashboard/requests/${request.id}`}
                className="flex items-center gap-3 px-1 py-3 hover:bg-muted/40 sm:px-2"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold tracking-wide text-primary">
                  {initials(request.customerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{request.serviceName}</p>
                    <StatusPill
                      label={request.statusLabel}
                      tone={requestTone(request.status as RequestStatus)}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {request.customerName} · {request.neighborhood}
                    {request.preferredDate ? ` · ${formatDate(request.preferredDate)}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <DashboardSection
          title="Messages"
          description="Website chats waiting on a reply."
          action={
            <Link
              href="/pro/dashboard/messages"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              Open messages
            </Link>
          }
        >
          <KpiStrip columns={1}>
            <StatCell
              embedded
              label="Unread messages"
              value={String(messages?.unreadChats ?? 0)}
              note="Website chats waiting on a reply"
              href="/pro/dashboard/messages"
            />
          </KpiStrip>
          <BoardCard
            embedded
            title="Website inbox"
            href="/pro/dashboard/messages"
            hrefLabel="View all"
            empty={inboxPreview.length ? undefined : "No new website chats or leads."}
          >
            {inboxPreview.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start gap-3 px-1 py-3 hover:bg-muted/40 sm:px-2"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    item.kind === "chat" ? "bg-[#c2410c]" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <DashboardSection
          title="Estimates"
          description="Quotes still in play."
          action={
            <Link
              href="/pro/dashboard/estimates"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              All estimates
            </Link>
          }
        >
          <KpiStrip columns={2}>
            <StatCell
              embedded
              label="Open estimates"
              value={String(estimates?.openCount ?? 0)}
              note={`${formatMoney(estimates?.pendingValue ?? 0)} in play`}
              href="/pro/dashboard/estimates"
            />
            <StatCell
              embedded
              label="Awaiting signature"
              value={String(estimates?.awaitingSignature ?? 0)}
              note="Sent and waiting on the customer"
              href="/pro/dashboard/estimates?status=sent"
            />
          </KpiStrip>
        </DashboardSection>

        <DashboardSection
          title="Jobs & schedule"
          description="Active work, crew coverage, and the week ahead."
          action={
            <Link
              href="/pro/dashboard/jobs"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              All jobs
            </Link>
          }
        >
          <KpiStrip columns={2}>
            <StatCell
              embedded
              label="Active jobs"
              value={String(jobs?.active ?? 0)}
              note={`${jobs?.scheduledThisWeek ?? 0} scheduled`}
              href="/pro/dashboard/jobs"
            />
            <BreakdownCard
              embedded
              label="Jobs by status"
              value={String(jobs?.total ?? 0)}
              href="/pro/dashboard/jobs"
              rows={jobs?.byStatus ?? []}
            />
          </KpiStrip>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <BoardCard
              embedded
              title="Upcoming jobs"
              href="/pro/dashboard/jobs"
              hrefLabel="View all"
              empty={upcomingJobs.length ? undefined : "No jobs yet."}
            >
              {upcomingJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/pro/dashboard/jobs/${job.id}`}
                  className="flex items-center gap-3 px-1 py-3 hover:bg-muted/40 sm:px-2"
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
                      {job.assignee ? ` · ${job.assignee}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
            <BoardCard
              embedded
              title="Upcoming schedule"
              href="/pro/dashboard/schedule"
              hrefLabel="Calendar"
              empty={upcomingSchedule.length ? undefined : "No scheduled blocks this week."}
            >
              {upcomingSchedule.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-1 py-3 hover:bg-muted/40 sm:px-2"
                >
                  <DateStamp value={item.date} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.detail}
                      {item.employeeName ? ` · ${item.employeeName}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Invoices & payments"
          description="Money owed, collected, and billed."
          action={
            <Link
              href="/pro/dashboard/invoices"
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              All invoices
            </Link>
          }
        >
          <KpiStrip columns={3}>
            <StatCell
              embedded
              label="Unpaid invoices"
              value={String(invoices?.unpaid.count ?? 0)}
              note={formatMoney(invoices?.unpaid.balanceDue ?? 0)}
              href="/pro/dashboard/invoices?status=unpaid"
            />
            <StatCell
              embedded
              label="Payments received"
              value={formatMoney(periodTotals.revenue)}
              note={`${periodTotals.count} in this range`}
              href="/pro/dashboard/payments"
            />
            <BreakdownCard
              embedded
              label="Invoices by aging"
              value={String(invoices?.total ?? 0)}
              href="/pro/dashboard/invoices"
              rows={invoices?.byAging ?? []}
            />
          </KpiStrip>
          <div className="rounded-lg border border-input bg-background px-4 py-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Revenue
                </p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(payments?.allTimeRevenue ?? 0)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">All-time collected</p>
            </div>
            <div
              className="mt-4 grid items-end gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(revenue.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {revenue.map((point, index) => {
                const last = index === revenue.length - 1;
                const ratio = maxRevenue > 0 ? point.value / maxRevenue : 0;
                const barHeight = point.value > 0 ? Math.max(8, ratio * 96) : 3;
                return (
                  <div key={point.key || point.label} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className={cn(
                          "w-3/5 max-w-9 rounded-sm",
                          last ? "bg-primary" : "bg-primary/20",
                        )}
                        style={{ height: `${barHeight}px` }}
                        title={`${point.label}: ${formatMoney(point.value)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Customers & people"
          description="Directory counts across your CRM."
        >
          <KpiStrip columns={4}>
            {peopleRows.map((row) => (
              <StatCell
                key={row.label}
                embedded
                label={row.label}
                value={String(row.value)}
                href={row.href}
              />
            ))}
          </KpiStrip>
        </DashboardSection>

        <DashboardSection
          title="Tasks & reminders"
          description="Personal follow-ups and scheduled notes."
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:items-start">
            <BoardCard
              embedded
              title="My day"
              href="/pro/dashboard/tasks"
              hrefLabel="All tasks"
              empty={myDayTasks.length ? undefined : "No open tasks due soon."}
            >
              {myDayTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/pro/dashboard/tasks/${task.id}`}
                  className="flex items-start gap-3 px-1 py-3 hover:bg-muted/40 sm:px-2"
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
                      {task.subjectKind
                        ? ` · ${reminderSubjectKindLabel(task.subjectKind as ReminderSubjectKind)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>

            <BoardCard
              embedded
              title="Reminders"
              href="/pro/dashboard/reminders"
              hrefLabel="All reminders"
              empty={dueReminders.length ? undefined : "No upcoming reminders."}
            >
              {dueReminders.map((item) => (
                <Link
                  key={item.id}
                  href={`/pro/dashboard/reminders/${item.id}`}
                  className="block px-1 py-3 hover:bg-muted/40 sm:px-2"
                >
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(item.dueAt)}
                    {item.subjectKind
                      ? ` · ${reminderSubjectKindLabel(item.subjectKind as ReminderSubjectKind)}`
                      : ""}
                  </p>
                </Link>
              ))}
            </BoardCard>

            <BoardCard
              embedded
              title="Recent activity"
              href="/pro/dashboard/reports"
              hrefLabel="Reports"
              empty={recentActivity.length ? undefined : "No recent activity."}
            >
              <ol className="flex flex-col px-1 py-1 sm:px-2">
                {recentActivity.map((item, index) => (
                  <li key={item.id} className="relative flex gap-3">
                    <span className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                      <span className={cn("mt-1.5 size-2 rounded-full", activityDot(item.title))} />
                      {index < recentActivity.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-border" />
                      ) : null}
                    </span>
                    <Link
                      href={item.href}
                      className={cn(
                        "min-w-0 flex-1 rounded-sm hover:text-primary",
                        index < recentActivity.length - 1 && "pb-3",
                      )}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.detail}
                        <span className="text-muted-foreground/70"> · {formatDate(item.at)}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            </BoardCard>
          </div>
        </DashboardSection>

        <section className="rounded-xl border border-input bg-card px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold">Quick actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLeadOpen(true)}>
              Create lead
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEstimateOpen(true)}>
              Create estimate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setJobOpen(true)}>
              Create job
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/pro/dashboard/invoices">Open invoices</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
              Create task
            </Button>
          </div>
        </section>
      </div>

      <CreateLeadDialog open={leadOpen} onOpenChange={setLeadOpen} />
      <CreateEstimateDialog open={estimateOpen} onOpenChange={setEstimateOpen} />
      <CreateJobDialog open={jobOpen} onOpenChange={setJobOpen} />
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </PortalPage>
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
