"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import { DashboardActionAlerts } from "@/components/portal/dashboard-action-alerts";
import {
  DashPanel,
  DonutChart,
  DualSeriesBars,
  FeedPanel,
  MetricTile,
  RevenueBars,
  StatusBars,
  WeekHeat,
} from "@/components/portal/dashboard-charts";
import {
  activityDot,
  dashboardGreeting,
  DateStamp,
  initials,
  PeriodBar,
  type DashboardPeriod,
} from "@/components/portal/dashboard-widgets";
import { CreateJobDialog, CreateLeadDialog } from "@/components/portal/create-work-dialogs";
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
import {
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/lib/data/estimate-v2-status";
import {
  listEstimateV2Opportunities,
  type EstimateV2Opportunity,
} from "@/lib/api/estimate-v2-client";
import type { JobStatus, RequestStatus } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ADMIN_DIRECT_THREAD_ID,
  listProviderChatThreads,
} from "@/lib/api/chat-client";
import { sortChatThreadsByUnreadThenRecent } from "@/lib/chat-format";

type RecentMessageRow = {
  id: string;
  href: string;
  title: string;
  detail: string;
  kind: "chat" | "lead";
  unread?: number;
};

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
  const [jobOpen, setJobOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [recentChatRows, setRecentChatRows] = useState<RecentMessageRow[]>([]);
  const [recentChatsLoading, setRecentChatsLoading] = useState(true);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [opportunityRows, setOpportunityRows] = useState<EstimateV2Opportunity[]>([]);
  const [opportunityTotal, setOpportunityTotal] = useState(0);

  useEffect(() => {
    void dispatch(fetchProviderDashboard({ force: true, silent: true }));
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listEstimateV2Opportunities({ page: 1, limit: 6 });
        if (cancelled) return;
        setOpportunityRows(result.items);
        setOpportunityTotal(result.total);
      } catch {
        if (!cancelled) {
          setOpportunityRows([]);
          setOpportunityTotal(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRecentChatsLoading(true);
    void (async () => {
      try {
        const threads = await listProviderChatThreads({
          silent: true,
          force: true,
        });
        if (cancelled) return;
        const rows: RecentMessageRow[] = sortChatThreadsByUnreadThenRecent(
          threads,
          (thread) => thread.unreadForProvider || 0,
        )
          .slice(0, 7)
          .map((thread) => {
            const last = thread.messages?.[thread.messages.length - 1];
            const lastText = String(last?.text || "").trim();
            const hasAttachment = Boolean(last?.attachments?.length);
            const from =
              last?.from === "provider"
                ? "You"
                : last?.from === "admin"
                  ? "Support"
                  : null;
            const detail = lastText
              ? from
                ? `${from}: ${lastText}`
                : lastText
              : hasAttachment
                ? from
                  ? `${from}: Sent an attachment`
                  : "Sent an attachment"
                : "Open conversation";
            const isAdmin = thread.id === ADMIN_DIRECT_THREAD_ID;
            return {
              id: thread.id,
              href: isAdmin
                ? "/pro/dashboard/messages?direct=admin"
                : `/pro/dashboard/messages?thread=${encodeURIComponent(thread.id)}`,
              title: thread.customerName || thread.customerEmail || "Customer",
              detail,
              kind: "chat" as const,
              unread: thread.unreadForProvider || 0,
            };
          });
        setRecentChatRows(rows);
      } catch {
        if (!cancelled) setRecentChatRows([]);
      } finally {
        if (!cancelled) setRecentChatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.generatedAt, chatRefreshKey]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (
        detail?.type === "LEAD_CREATED" ||
        detail?.type === "LEAD_UPDATED" ||
        detail?.type === "CHAT_MESSAGE" ||
        detail?.type === "NEW_CHAT_MESSAGE" ||
        detail?.type === "INBOX_SUMMARY_INVALIDATE"
      ) {
        void dispatch(fetchProviderDashboard({ force: true, silent: true }));
        if (
          detail?.type === "CHAT_MESSAGE" ||
          detail?.type === "NEW_CHAT_MESSAGE" ||
          detail?.type === "INBOX_SUMMARY_INVALIDATE"
        ) {
          setChatRefreshKey((key) => key + 1);
        }
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
  const jobsChart = data?.jobsChart?.[period === "today" ? "month" : period === "week" ? "month" : "month"] ?? [];
  const leadStatus = leads?.byStatus ?? [];
  const leadTotal = Math.max(leads?.total ?? 0, leadStatus.reduce((s, r) => s + r.value, 0));
  const invoiceAging = invoices?.byAging ?? [];
  const agingTotal = Math.max(invoices?.total ?? 0, invoiceAging.reduce((s, r) => s + r.value, 0));
  const weekDays = schedule?.weekDays ?? [];

  const incomingLeads = (leads?.incoming ?? []).slice(0, 8);
  const inboxPreview = useMemo(() => {
    if (recentChatRows.length) return recentChatRows;
    return (messages?.inboxPreview ?? []).slice(0, 7);
  }, [messages?.inboxPreview, recentChatRows]);
  const unreadChatCount = useMemo(() => {
    if (recentChatRows.length) {
      return recentChatRows.reduce((sum, row) => sum + (row.unread || 0), 0);
    }
    return messages?.unreadChats ?? 0;
  }, [messages?.unreadChats, recentChatRows]);
  const upcomingJobs = (jobs?.upcoming ?? []).slice(0, 6);
  const upcomingSchedule = (schedule?.upcoming ?? []).slice(0, 6);
  const myDayTasks = (tasks?.myDay ?? []).slice(0, 6);
  const dueReminders = (reminders?.dueNext14Days ?? []).slice(0, 6);
  const recentActivity = activity.slice(0, 7);
  const showLoading = loading && !data;

  const attentionItems = [
    {
      label: "Overdue invoices",
      value: String(attention?.overdueInvoices.count ?? 0),
      note: `${formatMoney(attention?.overdueInvoices.amountPastDue ?? 0)} past due`,
      href: "/pro/dashboard/invoices?status=overdue",
      hot: (attention?.overdueInvoices.count ?? 0) > 0,
    },
    {
      label: "Uninvoiced jobs",
      value: String(attention?.uninvoicedCompletedJobs ?? 0),
      note: "Ready to bill",
      href: "/pro/dashboard/jobs?status=completed",
      hot: (attention?.uninvoicedCompletedJobs ?? 0) > 0,
    },
    {
      label: "Unassigned jobs",
      value: String(attention?.unassignedActiveJobs ?? 0),
      note: "Need a crew",
      href: "/pro/dashboard/jobs?status=unscheduled",
      hot: (attention?.unassignedActiveJobs ?? 0) > 0,
    },
    {
      label: "Overdue tasks",
      value: String(attention?.overdueTasks ?? 0),
      note: "Past due date",
      href: "/pro/dashboard/tasks",
      hot: (attention?.overdueTasks ?? 0) > 0,
    },
  ];

  return (
    <PortalPage
      eyebrow="Overview"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · ${companyName}${city || state ? ` · ${[city, state].filter(Boolean).join(", ")}` : ""}`}
      actions={<DashboardSwitcher />}
    >
      <div className={cn("flex flex-col gap-3", showLoading && "opacity-60")}>
        <DashboardActionAlerts />

        {setup.percent < 100 ? (
          <Card className="border-input/80 bg-primary/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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
            <CardContent className="pb-4">
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${setup.percent}%` }} />
              </div>
              <ProfileSetupChips items={setupItems} />
            </CardContent>
          </Card>
        ) : null}

        {/* Exceptions — one slim strip, no nested boxes */}
        <section className="overflow-hidden rounded-xl border border-input/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-input/70 px-4 py-2.5">
            <h2 className="text-[13px] font-semibold tracking-tight">Needs attention</h2>
            <p className="text-[11px] text-muted-foreground">Handle these first</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-input/60 lg:grid-cols-4 lg:divide-y-0">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums tracking-tight",
                    item.hot && "text-amber-700",
                  )}
                >
                  {item.value}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.note}</p>
              </Link>
            ))}
          </div>
        </section>

        <PeriodBar value={period} onChange={setPeriod} />

        {/* Pipeline + Incoming */}
        <div className="grid gap-3 xl:grid-cols-12">
          <DashPanel
            title="Lead pipeline"
            href="/pro/dashboard/requests"
            hrefLabel="All leads"
            className="xl:col-span-7"
          >
            <div className="mb-4 grid grid-cols-2 gap-1 sm:grid-cols-3">
              <MetricTile
                label="Open"
                value={String(Math.max(leads?.openCount ?? 0, leads?.newFromWebsite ?? 0))}
                note="Active pipeline"
                href="/pro/dashboard/requests?status=new,viewed"
                accent
              />
              <MetricTile
                label="New from web"
                value={String(leads?.newFromWebsite ?? 0)}
                note="Website requests"
                href="/pro/dashboard/requests?status=new"
              />
              <MetricTile
                label="Total leads"
                value={String(leads?.total ?? 0)}
                note="All time in CRM"
                href="/pro/dashboard/requests"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <DonutChart
                rows={leadStatus}
                total={leadTotal || 1}
                centerLabel="Leads"
                centerValue={String(leadTotal)}
                size={120}
              />
              <StatusBars rows={leadStatus} total={leadTotal || 1} />
            </div>
          </DashPanel>

          <div className="xl:col-span-5">
            <FeedPanel
              title="Incoming requests"
              href="/pro/dashboard/requests"
              hrefLabel="View all"
              empty={incomingLeads.length ? undefined : "No incoming leads yet."}
            >
              {incomingLeads.map((request) => (
                <Link
                  key={request.id}
                  href={`/pro/dashboard/requests/${request.id}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
                    {initials(request.customerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{request.serviceName}</p>
                      <StatusPill
                        label={request.statusLabel}
                        tone={requestTone(request.status as RequestStatus)}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {request.customerName}
                      {request.neighborhood ? ` · ${request.neighborhood}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </FeedPanel>
          </div>
        </div>

        {/* Revenue + Inbox */}
        <div className="grid gap-3 xl:grid-cols-12">
          <DashPanel
            title="Revenue"
            href="/pro/dashboard/payments"
            hrefLabel="Payments"
            className="xl:col-span-8"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(periodTotals.revenue)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {periodTotals.count} payment{periodTotals.count === 1 ? "" : "s"} this{" "}
                  {period === "today" ? "day" : period === "week" ? "week" : "month"}
                  {" · "}
                  {formatMoney(payments?.allTimeRevenue ?? 0)} all-time
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-right">
                <div>
                  <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    Unpaid
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(invoices?.unpaid.balanceDue ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    Open invoices
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {invoices?.unpaid.count ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 pt-3 pb-2">
              <RevenueBars points={revenue} formatValue={formatMoney} />
            </div>
          </DashPanel>

          <div className="xl:col-span-4">
            <FeedPanel
              title="Recent Messages"
              href="/pro/dashboard/messages"
              hrefLabel="Messages"
              empty={
                !recentChatsLoading && inboxPreview.length === 0
                  ? "No conversations yet."
                  : undefined
              }
            >
              {recentChatsLoading && inboxPreview.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading conversations…
                </p>
              ) : (
                <>
              <div className="border-b border-input/60 px-3.5 py-2.5">
                <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  Unread
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {unreadChatCount}
                </p>
              </div>
              {inboxPreview.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      (item.unread ?? 0) > 0 || item.kind === "chat"
                        ? "bg-[#c2410c]"
                        : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-[13px]",
                          (item.unread ?? 0) > 0
                            ? "font-semibold text-foreground"
                            : "font-medium",
                        )}
                      >
                        {item.title}
                      </p>
                      {(item.unread ?? 0) > 0 ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                          {item.unread}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </Link>
              ))}
                </>
              )}
            </FeedPanel>
          </div>
        </div>

        {/* Jobs + Schedule */}
        <div className="grid gap-3 xl:grid-cols-12">
          <DashPanel
            title="Jobs & production"
            href="/pro/dashboard/jobs"
            hrefLabel="All jobs"
            className="xl:col-span-7"
          >
            <div className="mb-4 grid grid-cols-2 gap-1 sm:grid-cols-4">
              <MetricTile
                label="Active"
                value={String(jobs?.active ?? 0)}
                href="/pro/dashboard/jobs"
                accent
              />
              <MetricTile
                label="This week"
                value={String(jobs?.scheduledThisWeek ?? 0)}
                href="/pro/dashboard/schedule"
              />
              <MetricTile
                label="In field"
                value={String(jobs?.inField ?? 0)}
                href="/pro/dashboard/jobs"
              />
              <MetricTile
                label="Held up"
                value={String(jobs?.heldUp ?? 0)}
                href="/pro/dashboard/jobs"
              />
            </div>
            <DualSeriesBars
              points={jobsChart}
              aKey="opened"
              bKey="finished"
              aLabel="Opened"
              bLabel="Finished"
            />
            {(jobs?.byStatus?.length ?? 0) > 0 ? (
              <div className="mt-4 border-t border-input/60 pt-3">
                <p className="mb-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  By status
                </p>
                <StatusBars rows={jobs?.byStatus ?? []} total={jobs?.total || 1} />
              </div>
            ) : null}
          </DashPanel>

          <div className="flex flex-col gap-3 xl:col-span-5">
            {weekDays.length > 0 ? (
              <DashPanel title="This week" href="/pro/dashboard/schedule" hrefLabel="Calendar">
                <WeekHeat days={weekDays} />
              </DashPanel>
            ) : null}
            <FeedPanel
              title="Upcoming schedule"
              href="/pro/dashboard/schedule"
              hrefLabel="Calendar"
              empty={upcomingSchedule.length ? undefined : "Nothing scheduled this week."}
              className="flex-1"
            >
              {upcomingSchedule.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <DateStamp value={item.date} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {item.detail}
                      {item.employeeName ? ` · ${item.employeeName}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </FeedPanel>
          </div>
        </div>

        {/* Money + people row */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DashPanel title="Estimates" href="/pro/dashboard/new-estimate" hrefLabel="All">
            <div className="grid grid-cols-2 gap-1">
              <MetricTile
                label="Open"
                value={String(opportunityTotal || estimates?.openCount || 0)}
                note={formatMoney(estimates?.pendingValue ?? 0)}
                href="/pro/dashboard/new-estimate"
                accent
              />
              <MetricTile
                label="Awaiting sign"
                value={String(
                  opportunityRows.filter((row) => row.status === "estimate_sent").length ||
                    estimates?.awaitingSignature ||
                    0,
                )}
                note="Sent to customer"
                href="/pro/dashboard/new-estimate"
              />
            </div>
            {opportunityRows.length > 0 ? (
              <ul className="mt-3 space-y-0 border-t border-input/60">
                {opportunityRows.slice(0, 4).map((row) => {
                  const customer =
                    typeof row.customerId === "object" && row.customerId
                      ? String(
                          row.customerId.companyName ||
                            [row.customerId.firstName, row.customerId.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            "Customer",
                        )
                      : "Customer";
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/pro/dashboard/new-estimate/${row.id}`}
                        className="flex items-center justify-between gap-2 py-2 text-[13px] transition-colors hover:text-primary"
                      >
                        <span className="min-w-0 truncate">
                          {row.number}
                          <span className="text-muted-foreground"> · {customer}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                            opportunityStatusTone(row.status),
                          )}
                        >
                          {opportunityStatusLabel(row.status)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </DashPanel>

          <DashPanel title="Invoice aging" href="/pro/dashboard/invoices" hrefLabel="All">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="text-xl font-semibold tabular-nums">
                {formatMoney(invoices?.unpaid.balanceDue ?? 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {invoices?.unpaid.count ?? 0} unpaid
              </p>
            </div>
            <StatusBars rows={invoiceAging} total={agingTotal || 1} />
          </DashPanel>

          <DashPanel title="Directory" href="/pro/dashboard/customers" hrefLabel="People">
            <div className="grid grid-cols-2 gap-1">
              <MetricTile
                label="Customers"
                value={String(people?.customers ?? 0)}
                href="/pro/dashboard/customers"
                accent
              />
              <MetricTile
                label="Employees"
                value={String(people?.employees ?? 0)}
                href="/pro/dashboard/employees"
              />
              <MetricTile
                label="Contractors"
                value={String(people?.contractors ?? 0)}
                href="/pro/dashboard/contractors"
              />
              <MetricTile
                label="Vendors"
                value={String(people?.vendors ?? 0)}
                href="/pro/dashboard/vendors"
              />
            </div>
          </DashPanel>
        </div>

        {/* Work queue */}
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <FeedPanel
            title="My day"
            href="/pro/dashboard/tasks"
            hrefLabel="Tasks"
            empty={myDayTasks.length ? undefined : "No tasks due soon."}
          >
            {myDayTasks.map((task) => (
              <Link
                key={task.id}
                href={`/pro/dashboard/tasks/${task.id}`}
                className="flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    task.isOverdue ? "bg-red-500" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{task.title}</p>
                    <p
                      className={cn(
                        "shrink-0 text-[11px]",
                        task.isOverdue ? "font-medium text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {formatDate(task.dueAt)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                    {crmTaskPriorityLabel((task.priority as CrmTaskPriority) || "normal")}
                    {task.subjectKind
                      ? ` · ${reminderSubjectKindLabel(task.subjectKind as ReminderSubjectKind)}`
                      : ""}
                  </p>
                </div>
              </Link>
            ))}
          </FeedPanel>

          <FeedPanel
            title="Reminders"
            href="/pro/dashboard/reminders"
            hrefLabel="All"
            empty={dueReminders.length ? undefined : "No upcoming reminders."}
          >
            {dueReminders.map((item) => (
              <Link
                key={item.id}
                href={`/pro/dashboard/reminders/${item.id}`}
                className="block px-3.5 py-2.5 transition-colors hover:bg-muted/40"
              >
                <p className="truncate text-[13px] font-medium">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(item.dueAt)}
                  {item.subjectKind
                    ? ` · ${reminderSubjectKindLabel(item.subjectKind as ReminderSubjectKind)}`
                    : ""}
                </p>
              </Link>
            ))}
          </FeedPanel>

          <FeedPanel
            title="Recent activity"
            href="/pro/dashboard/reports"
            hrefLabel="Reports"
            empty={recentActivity.length ? undefined : "No recent activity."}
          >
            {recentActivity.map((item, index) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="flex w-2.5 shrink-0 flex-col items-center" aria-hidden>
                  <span className={cn("mt-1.5 size-1.5 rounded-full", activityDot(item.title))} />
                  {index < recentActivity.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-border" />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.detail}
                    <span className="text-muted-foreground/70"> · {formatDate(item.at)}</span>
                  </p>
                </div>
              </Link>
            ))}
          </FeedPanel>
        </div>

        {/* Upcoming jobs — compact full-width when present */}
        {upcomingJobs.length > 0 ? (
          <DashPanel title="Upcoming jobs" href="/pro/dashboard/jobs" hrefLabel="All jobs" bodyClassName="p-0">
            <div className="divide-y divide-input/60">
              {upcomingJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/pro/dashboard/jobs/${job.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <DateStamp value={job.scheduledAt ?? undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">
                        {job.number}
                        <span className="font-normal text-muted-foreground"> · {job.customerName}</span>
                      </p>
                      <StatusPill
                        label={job.statusLabel}
                        className={jobStatusTone(job.status as JobStatus)}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {job.detail || job.city}
                      {job.assignee ? ` · ${job.assignee}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </DashPanel>
        ) : null}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input/80 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[13px] font-semibold">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLeadOpen(true)}>
              Create lead
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/pro/dashboard/new-estimate/new">Create estimate</Link>
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
