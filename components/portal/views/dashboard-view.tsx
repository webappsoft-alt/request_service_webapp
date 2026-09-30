"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import { DashboardActionAlerts } from "@/components/portal/dashboard-action-alerts";
import {
  activityDot,
  BoardCard,
  BreakdownCard,
  DashboardSection,
  dashboardGreeting,
  DateStamp,
  initials,
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
    { label: "Customers", value: people?.customers ?? 0 },
    { label: "Employees", value: people?.employees ?? 0 },
    { label: "Contractors", value: people?.contractors ?? 0 },
    { label: "Vendors", value: people?.vendors ?? 0 },
  ];
  const showLoading = loading && !data;

  return (
    <PortalPage
      eyebrow="Overview"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · ${companyName}${city || state ? ` · ${[city, state].filter(Boolean).join(", ")}` : ""}`}
      actions={<DashboardSwitcher />}
    >
      <div className={cn(showLoading && "opacity-60")}>
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

        <DashboardSection title="Needs attention" description="Urgent items that should be handled first.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCell
              label="Overdue invoices"
              value={String(attention?.overdueInvoices.count ?? 0)}
              note={`${formatMoney(attention?.overdueInvoices.amountPastDue ?? 0)} past due`}
              href="/pro/dashboard/invoices?status=overdue"
            />
            <StatCell
              label="Uninvoiced completed jobs"
              value={String(attention?.uninvoicedCompletedJobs ?? 0)}
              note="Finished work still waiting on an invoice"
              href="/pro/dashboard/jobs?status=completed"
            />
            <StatCell
              label="Jobs with no team member"
              value={String(attention?.unassignedActiveJobs ?? 0)}
              note="Active jobs still unassigned"
              href="/pro/dashboard/jobs?status=unscheduled"
            />
            <StatCell
              label="Overdue tasks"
              value={String(attention?.overdueTasks ?? 0)}
              note="Open work past its due date"
              href="/pro/dashboard/tasks"
            />
          </div>
        </DashboardSection>

        <PeriodBar value={period} onChange={setPeriod} />

        <DashboardSection title="Leads" description="Open pipeline from the website and CRM.">
          <div className="grid gap-3 lg:grid-cols-3">
            <StatCell
              label="Open leads"
              value={String(Math.max(leads?.openCount ?? 0, leads?.newFromWebsite ?? 0))}
              note={`${leads?.newFromWebsite ?? 0} new from the website`}
              href="/pro/dashboard/requests?status=new,viewed"
            />
            <BreakdownCard
              label="Leads by status"
              value={String(leads?.total ?? 0)}
              href="/pro/dashboard/requests"
              rows={leads?.byStatus ?? []}
            />
            <BoardCard
              title="Incoming requests"
              href="/pro/dashboard/requests"
              hrefLabel="All leads"
              empty={(leads?.incoming.length ?? 0) ? undefined : "No incoming leads yet."}
            >
              {(leads?.incoming ?? []).map((request) => (
                <Link
                  key={request.id}
                  href={`/pro/dashboard/requests/${request.id}`}
                  className="flex items-center gap-3.5 px-(--card-spacing) py-4 hover:bg-muted/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold tracking-wide text-primary">
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
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {request.customerName} · {request.neighborhood}
                      {request.preferredDate ? ` · ${formatDate(request.preferredDate)}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
          </div>
        </DashboardSection>

        <DashboardSection title="Messages" description="Website chats waiting on a reply.">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCell
              label="Unread messages"
              value={String(messages?.unreadChats ?? 0)}
              note="Website chats waiting on a reply"
              href="/pro/dashboard/messages"
            />
            <BoardCard
              title="Website inbox"
              href="/pro/dashboard/messages"
              hrefLabel="Open messages"
              empty={(messages?.inboxPreview.length ?? 0) ? undefined : "No new website chats or leads."}
            >
              {(messages?.inboxPreview ?? []).slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
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
          </div>
        </DashboardSection>

        <DashboardSection title="Estimates" description="Quotes still in play.">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCell
              label="Open estimates"
              value={String(estimates?.openCount ?? 0)}
              note={`${formatMoney(estimates?.pendingValue ?? 0)} in play`}
              href="/pro/dashboard/estimates"
            />
            <StatCell
              label="Awaiting signature"
              value={String(estimates?.awaitingSignature ?? 0)}
              note="Sent and waiting on the customer"
              href="/pro/dashboard/estimates?status=sent"
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Jobs & schedule" description="Active work, crew coverage, and the week ahead.">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCell
              label="Active jobs"
              value={String(jobs?.active ?? 0)}
              note={`${jobs?.scheduledThisWeek ?? 0} scheduled`}
              href="/pro/dashboard/jobs"
            />
            <BreakdownCard
              label="Jobs by status"
              value={String(jobs?.total ?? 0)}
              href="/pro/dashboard/jobs"
              rows={jobs?.byStatus ?? []}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BoardCard
              title="Upcoming jobs"
              href="/pro/dashboard/jobs"
              hrefLabel="All jobs"
              empty={(jobs?.upcoming.length ?? 0) ? undefined : "No jobs yet."}
            >
              {(jobs?.upcoming ?? []).map((job) => (
                <Link
                  key={job.id}
                  href={`/pro/dashboard/jobs/${job.id}`}
                  className="flex items-center gap-3.5 px-(--card-spacing) py-4 hover:bg-muted/40"
                >
                  <DateStamp value={job.scheduledAt ?? undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {job.number}
                        <span className="font-normal text-muted-foreground"> · {job.customerName}</span>
                      </p>
                      <StatusPill
                        label={job.statusLabel}
                        className={jobStatusTone(job.status as JobStatus)}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.detail || job.city}
                      {job.assignee ? ` · ${job.assignee}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
            <BoardCard
              title="Upcoming schedule"
              href="/pro/dashboard/schedule"
              hrefLabel="Calendar"
              empty={(schedule?.upcoming.length ?? 0) ? undefined : "No scheduled blocks this week."}
            >
              {(schedule?.upcoming ?? []).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
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

        <DashboardSection title="Invoices & payments" description="Money owed, collected, and billed.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCell
              label="Unpaid invoices"
              value={String(invoices?.unpaid.count ?? 0)}
              note={formatMoney(invoices?.unpaid.balanceDue ?? 0)}
              href="/pro/dashboard/invoices?status=unpaid"
            />
            <StatCell
              label="Payments received"
              value={formatMoney(periodTotals.revenue)}
              note={`${periodTotals.count} in this range`}
              href="/pro/dashboard/payments"
            />
            <BreakdownCard
              label="Invoices by aging"
              value={String(invoices?.total ?? 0)}
              href="/pro/dashboard/invoices"
              rows={invoices?.byAging ?? []}
            />
          </div>
          <Card className="border-input">
            <CardHeader className="gap-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatMoney(payments?.allTimeRevenue ?? 0)}
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="grid items-end gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(revenue.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {revenue.map((point, index) => {
                  const last = index === revenue.length - 1;
                  const ratio = maxRevenue > 0 ? point.value / maxRevenue : 0;
                  const barHeight = point.value > 0 ? Math.max(8, ratio * 112) : 3;
                  return (
                    <div key={point.key || point.label} className="flex flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end justify-center">
                        <div
                          className={cn(
                            "w-3/5 max-w-10 rounded-sm",
                            last ? "bg-primary" : "bg-primary/20",
                          )}
                          style={{ height: `${barHeight}px` }}
                          title={`${point.label}: ${formatMoney(point.value)}`}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </DashboardSection>

        <DashboardSection title="Customers & people" description="Directory counts across your CRM.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {peopleRows.map((row) => (
              <StatCell
                key={row.label}
                label={row.label}
                value={String(row.value)}
                href={
                  row.label === "Customers"
                    ? "/pro/dashboard/customers"
                    : row.label === "Employees"
                      ? "/pro/dashboard/employees"
                      : row.label === "Contractors"
                        ? "/pro/dashboard/contractors"
                        : "/pro/dashboard/vendors"
                }
              />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection title="Tasks & reminders" description="Personal follow-ups and scheduled notes.">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                      {task.subjectKind
                        ? ` · ${reminderSubjectKindLabel(task.subjectKind as ReminderSubjectKind)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>

            <Card className="border-input">
              <CardHeader className="gap-1">
                <CardTitle>Reminders</CardTitle>
                <p className="text-sm text-muted-foreground">Open reminders in the next 14 days.</p>
              </CardHeader>
              <CardContent>
                {(reminders?.dueNext14Days.length ?? 0) ? (
                  <ul className="space-y-2">
                    {(reminders?.dueNext14Days ?? []).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/pro/dashboard/reminders/${item.id}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.dueAt)}
                          {item.subjectKind
                            ? ` · ${reminderSubjectKindLabel(item.subjectKind as ReminderSubjectKind)}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming reminders.</p>
                )}
              </CardContent>
            </Card>

            <BoardCard title="Recent activity" href="/pro/dashboard/reports" hrefLabel="Reports">
              <ol className="flex flex-col px-(--card-spacing) py-3">
                {activity.map((item, index) => (
                  <li key={item.id} className="relative flex gap-3.5">
                    <span className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                      <span className={cn("mt-1.5 size-2 rounded-full", activityDot(item.title))} />
                      {index < activity.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-border" />
                      ) : null}
                    </span>
                    <Link
                      href={item.href}
                      className={cn(
                        "min-w-0 flex-1 rounded-sm hover:text-primary",
                        index < activity.length - 1 && "pb-4",
                      )}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
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

        <section className="rounded-xl border border-input bg-card px-5 py-5">
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
