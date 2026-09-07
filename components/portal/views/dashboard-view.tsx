"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import {
  activityDot,
  AlertCell,
  BoardCard,
  BreakdownCard,
  dashboardGreeting,
  DateStamp,
  inDashboardPeriod,
  initials,
  PeriodBar,
  StatCell,
  type DashboardPeriod,
} from "@/components/portal/dashboard-widgets";
import { CreateEstimateDialog, CreateJobDialog, CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  crmTaskPriorityLabel,
  reminderSubject,
  reminderSubjectKindLabel,
  taskIsOpen,
  taskIsOverdue,
  taskSubject,
} from "@/lib/data/crm-people";
import {
  getPortalCustomerName,
  invoiceDaysOverdue,
  invoiceIsUnpaid,
  invoiceStatusLabel,
  jobStatusLabel,
  jobStatusTone,
  paymentNumber,
  requestStatusLabel,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

function jobIsActive(job: Job) {
  return job.status !== "completed" && job.status !== "invoiced" && job.status !== "paid" && job.status !== "cancelled";
}

function jobNeedsInvoice(job: Job) {
  return job.status === "completed";
}

function agingLabel(invoice: Invoice) {
  switch (invoice.status) {
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    case "sent":
    case "partially_paid":
    case "overdue": {
      const days = invoiceDaysOverdue(invoice);
      if (days >= 91) return "91+ days overdue";
      if (days >= 61) return "61–90 days overdue";
      if (days >= 31) return "31–60 days overdue";
      if (days >= 1) return "1–30 days overdue";
      return invoiceStatusLabel(invoice.status);
    }
    default: {
      const _never: never = invoice.status;
      return _never;
    }
  }
}

function countBy(rows: { label: string }[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.label, (map.get(row.label) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function DashboardView() {
  const { provider, stats, activity, revenue, requests, jobs, estimates, invoices, payments } = usePortalWorkspace();
  const { customers, contractors, vendors, tasks, reminders, employees } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const inbox = usePortalInbox();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [leadOpen, setLeadOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const firstName = provider.contact?.name?.split(" ")[0] ?? "there";
  const allJobs = records.listed("job", records.mergeJobs(jobs), false);
  const allEstimates = records.listed("estimate", records.mergeEstimates(estimates), false);
  const allInvoices = records.listed("invoice", records.mergeInvoices(invoices), false);
  const allRequests = records.listed("request", records.mergeRequests(requests), false);
  const allPayments = records.listed("payment", records.mergePayments(payments), false);
  const allTasks = records.listed("task", tasks, false);

  const openLeads = allRequests.filter(
    (item) => item.status !== "declined" && item.status !== "closed" && item.status !== "converted_to_job",
  );
  const openEstimates = allEstimates.filter(
    (item) => item.status !== "accepted" && item.status !== "rejected" && item.status !== "expired",
  );
  const activeJobs = allJobs.filter(jobIsActive);
  const unpaid = allInvoices.filter((item) => invoiceIsUnpaid(item.status));
  const overdue = allInvoices.filter((item) => item.status === "overdue" || invoiceDaysOverdue(item) > 0);
  const uninvoiced = allJobs.filter(jobNeedsInvoice);
  const unassigned = activeJobs.filter((job) => {
    const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
    return !job.assignedTo && !event?.employeeId;
  });
  const overdueTasks = allTasks.filter((item) => taskIsOverdue(item, todayKey));
  const myDay = allTasks
    .filter((item) => taskIsOpen(item) && (taskIsOverdue(item, todayKey) || item.dueAt <= addDays(todayKey, 7)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 6);
  const upcomingEvents = events
    .filter((item) => item.date && item.date >= todayKey && item.date <= addDays(todayKey, 7) && item.kind !== "invoice")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, 6);
  const dueReminders = reminders
    .filter((item) => item.status === "open" && item.dueAt <= addDays(todayKey, 14))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const periodPayments = allPayments.filter((item) => inDashboardPeriod(item.paidAt ?? item.createdAt, period, today));
  const periodRevenue = periodPayments.reduce((sum, item) => sum + item.amount, 0);
  const maxRevenue = Math.max(...revenue.map((point) => point.value), 1);

  const feed = useMemo(() => {
    const extra = [
      ...allPayments.slice(0, 4).map((item) => ({
        id: item.id,
        title: "Payment recorded",
        detail: `${paymentNumber(item)} · ${formatMoney(item.amount)}`,
        at: item.paidAt ?? item.createdAt,
        href: `/pro/dashboard/payments/${item.id}`,
      })),
      ...overdueTasks.slice(0, 2).map((item) => ({
        id: item.id,
        title: "Task overdue",
        detail: item.title,
        at: item.dueAt,
        href: `/pro/dashboard/tasks/${item.id}`,
      })),
    ];
    return [...activity, ...extra]
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
      .slice(0, 10);
  }, [activity, allPayments, overdueTasks]);

  const peopleRows = [
    { label: "Customers", value: customers.length },
    { label: "Employees", value: employees.length },
    { label: "Contractors", value: contractors.length },
    { label: "Vendors", value: vendors.length },
  ];
  const leadRows = countBy(allRequests.map((item) => ({ label: requestStatusLabel(item.status) }))).slice(0, 6);
  const jobRows = countBy(allJobs.map((item) => ({ label: jobStatusLabel(item.status) }))).slice(0, 6);
  const invoiceRows = countBy(allInvoices.map((item) => ({ label: agingLabel(item) }))).slice(0, 6);

  const alertItems = [
    { label: "Leads", value: openLeads.filter((item) => item.status === "new").length, href: "/pro/dashboard/requests?status=new" },
    { label: "Messages", value: inbox.unreadChats, href: "/pro/dashboard/messages" },
    { label: "Estimates", value: openEstimates.filter((item) => item.status === "sent").length, href: "/pro/dashboard/estimates?status=sent" },
    { label: "Jobs", value: unassigned.length + uninvoiced.length, href: "/pro/dashboard/jobs" },
    { label: "Tasks", value: overdueTasks.length, href: "/pro/dashboard/tasks" },
    { label: "Invoices", value: overdue.length, href: "/pro/dashboard/invoices?status=overdue" },
  ].filter((item) => item.value > 0);

  return (
    <PortalPage
      eyebrow="Overview"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · ${provider.companyName} · ${provider.city}, ${provider.state}`}
      actions={<DashboardSwitcher />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Overdue invoices"
          value={String(overdue.length)}
          note={`${formatMoney(overdue.reduce((sum, item) => sum + item.balanceDue, 0))} past due`}
          href="/pro/dashboard/invoices?status=overdue"
        />
        <StatCell
          label="Uninvoiced completed jobs"
          value={String(uninvoiced.length)}
          note="Finished work still waiting on an invoice"
          href="/pro/dashboard/jobs?status=completed"
        />
        <StatCell
          label="Jobs with no technician"
          value={String(unassigned.length)}
          note="Active jobs still unassigned"
          href="/pro/dashboard/jobs?status=unscheduled"
        />
        <StatCell
          label="Overdue tasks"
          value={String(overdueTasks.length)}
          note="Open work past its due date"
          href="/pro/dashboard/tasks"
        />
      </div>

      <PeriodBar value={period} onChange={setPeriod} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCell
          label="Open leads"
          value={String(openLeads.length)}
          note={`${inbox.newLeads} new from the website`}
          href="/pro/dashboard/requests?status=new"
        />
        <StatCell
          label="Unread messages"
          value={String(inbox.unreadChats)}
          note="Website chats waiting on a reply"
          href="/pro/dashboard/messages"
        />
        <StatCell
          label="Open estimates"
          value={String(openEstimates.length)}
          note={`${formatMoney(stats.pendingEstimateValue)} in play`}
          href="/pro/dashboard/estimates"
        />
        <StatCell
          label="Active jobs"
          value={String(activeJobs.length)}
          note={`${stats.scheduledThisWeek} scheduled`}
          href="/pro/dashboard/jobs"
        />
        <StatCell
          label="Unpaid invoices"
          value={String(unpaid.length)}
          note={formatMoney(unpaid.reduce((sum, item) => sum + item.balanceDue, 0))}
          href="/pro/dashboard/invoices?status=unpaid"
        />
        <StatCell
          label="Payments received"
          value={formatMoney(periodRevenue)}
          note={`${periodPayments.length} in this range`}
          href="/pro/dashboard/payments"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <BreakdownCard label="People" value={String(peopleRows.reduce((sum, row) => sum + row.value, 0))} href="/pro/dashboard/customers" rows={peopleRows} />
        <BreakdownCard label="Leads" value={String(allRequests.length)} href="/pro/dashboard/requests" rows={leadRows} />
        <BreakdownCard label="Jobs" value={String(allJobs.length)} href="/pro/dashboard/jobs" rows={jobRows} />
        <BreakdownCard label="Invoices" value={String(allInvoices.length)} href="/pro/dashboard/invoices" rows={invoiceRows} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.35fr_0.9fr] xl:items-start">
        <Card className="border-border">
          <CardHeader className="gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(stats.revenue)}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 items-end gap-3">
              {revenue.map((point, index) => {
                const last = index === revenue.length - 1;
                return (
                  <div key={point.label} className="flex flex-col items-center gap-2">
                    <div
                      className={cn("w-full rounded-sm", last ? "bg-primary" : "bg-primary/15")}
                      style={{ height: `${Math.max(16, (point.value / maxRevenue) * 128)}px` }}
                    />
                    <span className="text-[11px] text-muted-foreground">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="gap-1">
            <CardTitle>Reminders</CardTitle>
            <p className="text-sm text-muted-foreground">Open reminders in the next 14 days and scheduled work this week.</p>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Notes</p>
              {dueReminders.length ? (
                <ul className="mt-2 space-y-2">
                  {dueReminders.map((item) => {
                    const subject = reminderSubject(item);
                    return (
                      <li key={item.id}>
                        <Link href={`/pro/dashboard/reminders/${item.id}`} className="text-sm font-medium hover:text-primary">
                          {item.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.dueAt)}
                          {subject.id ? ` · ${reminderSubjectKindLabel(subject.kind)}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No upcoming reminders.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Scheduled</p>
              {upcomingEvents.length ? (
                <ul className="mt-2 space-y-2">
                  {upcomingEvents.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="text-sm font-medium hover:text-primary">
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.date ? formatDate(item.date) : "Unscheduled"}
                        {item.employeeId ? ` · ${employeeLabel(item.employeeId)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled this week.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BoardCard
          title="My day"
          href="/pro/dashboard/tasks"
          hrefLabel="All tasks"
          empty={myDay.length ? undefined : "No open tasks due soon."}
        >
          {myDay.map((task) => {
            const subject = taskSubject(task);
            return (
              <Link
                key={task.id}
                href={`/pro/dashboard/tasks/${task.id}`}
                className="flex items-start gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
              >
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", taskIsOverdue(task, todayKey) ? "bg-red-500" : "bg-primary")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className={cn("shrink-0 text-xs", taskIsOverdue(task, todayKey) ? "font-medium text-red-600" : "text-muted-foreground")}>
                      {formatDate(task.dueAt)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {crmTaskPriorityLabel(task.priority)}
                    {subject.id ? ` · ${reminderSubjectKindLabel(subject.kind)}` : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </BoardCard>

        <BoardCard
          title="Upcoming schedule"
          href="/pro/dashboard/schedule"
          hrefLabel="Calendar"
          empty={upcomingEvents.length ? undefined : "No scheduled blocks this week."}
        >
          {upcomingEvents.map((item) => (
            <Link key={item.id} href={item.href} className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40">
              <DateStamp value={item.date} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.detail}
                  {item.employeeId ? ` · ${employeeLabel(item.employeeId)}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </BoardCard>

        <BoardCard title="Recent activity" href="/pro/dashboard/reports" hrefLabel="Reports">
          <ol className="flex flex-col px-(--card-spacing) py-3">
            {feed.map((item, index) => (
              <li key={item.id} className="relative flex gap-3.5">
                <span className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                  <span className={cn("mt-1.5 size-2 rounded-full", activityDot(item.title))} />
                  {index < feed.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </span>
                <Link
                  href={item.href}
                  className={cn("min-w-0 flex-1 rounded-sm hover:text-primary", index < feed.length - 1 && "pb-4")}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <BoardCard
          title="Website inbox"
          href="/pro/dashboard/messages"
          hrefLabel="Open messages"
          empty={inbox.items.length ? undefined : "No new website chats or quote requests."}
        >
          {inbox.items.slice(0, 5).map((item) => (
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
        <BoardCard title="Incoming requests" href="/pro/dashboard/requests" hrefLabel="All leads">
          {allRequests.slice(0, 4).map((request) => (
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
                  <StatusPill label={requestStatusLabel(request.status)} tone={requestTone(request.status)} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {request.customerName} · {request.neighborhood}
                  {request.preferredDate ? ` · ${formatDate(request.preferredDate)}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </BoardCard>

        <BoardCard title="Upcoming jobs" href="/pro/dashboard/jobs" hrefLabel="All jobs">
          {allJobs.slice(0, 4).map((job) => {
            const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
            const date = event?.date ?? job.scheduledAt;
            return (
              <Link
                key={job.id}
                href={`/pro/dashboard/jobs/${job.id}`}
                className="flex items-center gap-3.5 px-(--card-spacing) py-4 hover:bg-muted/40"
              >
                <DateStamp value={date} />
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
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {event?.detail ?? job.address.city}
                    {event?.employeeId ? ` · ${employeeLabel(event.employeeId)}` : job.assignedTo ? ` · ${job.assignedTo}` : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </BoardCard>
      </div>

      {alertItems.length ? (
        <section className="rounded-xl border border-border bg-card px-5 py-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <p className="text-sm text-muted-foreground">
              {alertItems.reduce((sum, item) => sum + item.value, 0)} items across the board
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {alertItems.map((item) => (
              <AlertCell key={item.label} {...item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card px-5 py-5">
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

      <CreateLeadDialog open={leadOpen} onOpenChange={setLeadOpen} />
      <CreateEstimateDialog open={estimateOpen} onOpenChange={setEstimateOpen} />
      <CreateJobDialog open={jobOpen} onOpenChange={setJobOpen} />
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </PortalPage>
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
