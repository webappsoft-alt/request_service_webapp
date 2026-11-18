"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, FileText, Plus, Receipt, Wallet } from "lucide-react";
import {
  BoardCard,
  dashboardGreeting,
} from "@/components/portal/dashboard-widgets";
import {
  ENTER_CLASS,
  enterStyle,
} from "@/components/account/customer-dashboard-widgets";
// import { useCustomerPendingBadge } from "@/components/account/use-customer-pending-badge"; — Messages card removed
import { CustomerActiveProjectCards } from "@/components/account/customer-active-projects";
import {
  CompactStat,
  CustomerEstimatesToReview,
  EstimateInsight,
  SpendingInsight,
  type NextVisit,
} from "@/components/account/customer-dashboard-advanced";
// (CustomerHeroSummary / CustomerActionCenter no longer rendered — client polish.)
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
// import { estimateStatusToneClass } from "@/lib/data/estimate-v2-status"; — old estimates list
import { Button } from "@/components/ui/button";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";
import { formatOrderMoney, orderServiceTitle } from "@/lib/orders/order-display";
import { formatOrderStatus } from "@/lib/orders/order-status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import {
  fetchCustomerOrders,
  selectCustomerOrders,
  selectCustomerOrdersLoading,
  selectCustomerOrdersPagination,
} from "@/store/ordersSlice";
import {
  CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT,
  fetchCustomerEstimates,
  fetchCustomerQuoteRequests,
  selectCustomerApiEstimates,
  selectCustomerApiEstimatesLoading,
  selectCustomerQuoteBatches,
  selectCustomerQuoteBatchesLoading,
  type CustomerQuoteBatch,
} from "@/store/customerQuotesSlice";
import {
  fetchCustomerInvoices,
  selectCustomerInvoices,
  selectCustomerInvoicesLoading,
} from "@/store/customerInvoicesSlice";
import {
  listCustomerChangeOrders,
  type CustomerChangeOrder,
} from "@/lib/api/customer-change-orders";

function batchKey(batch: CustomerQuoteBatch) {
  return (
    batch.quoteBatchId ||
    batch.professionals[0]?.requestId ||
    `${batch.serviceName}-${batch.createdAt}`
  );
}

function isDeclinedStatus(status: string) {
  const clean = String(status || "").toLowerCase();
  return ["declined", "rejected", "closed", "cancelled"].includes(clean);
}

function batchStatusLabel(batch: CustomerQuoteBatch) {
  const pros = batch.professionals || [];
  const statuses = pros.map((p) => String(p.status || "").toLowerCase());
  if (statuses.some((s) => s === "converted_to_job")) return "Job Created";
  if (statuses.some((s) => s === "accepted")) return "Accepted";
  if (batch.estimateCount > 0 || statuses.some((s) => s === "estimate_sent"))
    return "Ready to review";
  if (statuses.some((s) => s === "changes_requested")) return "Changes Requested";
  if (statuses.some((s) => s === "site_visit")) return "Site Visit";

  if (pros.length > 0 && statuses.every(isDeclinedStatus)) {
    return "Declined";
  }

  if (batch.seenCount > 0 || statuses.some((s) => s === "viewed" || s === "contacted")) {
    return "Viewed";
  }
  return "Dispatched";
}

function batchTone(batch: CustomerQuoteBatch) {
  const pros = batch.professionals || [];
  const statuses = pros.map((p) => String(p.status || "").toLowerCase());
  if (statuses.some((s) => s === "converted_to_job" || s === "accepted"))
    return "success" as const;
  if (batch.estimateCount > 0 || statuses.some((s) => s === "estimate_sent"))
    return "primary" as const;

  if (pros.length > 0 && statuses.every(isDeclinedStatus)) {
    return "danger" as const;
  }

  if (batch.seenCount > 0 || statuses.some((s) => s === "viewed" || s === "contacted")) {
    return "warning" as const;
  }
  return "neutral" as const;
}

// Used by the old estimates list (now CustomerEstimatesToReview).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function estimateStatusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "converted_to_job") return "Job Created";
  if (clean === "site_visit") return "Site Visit";
  if (clean === "changes_requested") return "Changes Requested";
  if (clean === "draft") return "Preparing";
  if (clean === "finalized") return "Almost ready";
  if (clean === "sent" || clean === "estimate_sent") return "Ready to review";
  if (clean === "accepted") return "Accepted";
  return clean
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function orderTone(status: string) {
  const up = String(status || "").toUpperCase();
  if (up === "SETTLED" || up === "WORK_COMPLETED") return "success" as const;
  if (up === "CANCELLED" || up === "DISPUTED") return "danger" as const;
  if (up === "IN_PROGRESS" || up === "IN_TRANSIT" || up === "ARRIVED")
    return "warning" as const;
  if (up === "CONFIRMED" || up === "BOOKING_REQUESTED")
    return "primary" as const;
  return "neutral" as const;
}

function invoiceStatusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "sent") return "Pending";
  if (clean === "partially_paid") return "Partially Paid";
  return clean
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CustomerDashboardView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const orders = useAppSelector(selectCustomerOrders);
  const ordersLoading = useAppSelector(selectCustomerOrdersLoading);
  const pagination = useAppSelector(selectCustomerOrdersPagination);
  const batches = useAppSelector(selectCustomerQuoteBatches);
  const batchesLoading = useAppSelector(selectCustomerQuoteBatchesLoading);
  const estimates = useAppSelector(selectCustomerApiEstimates);
  const estimatesLoading = useAppSelector(selectCustomerApiEstimatesLoading);
  const invoices = useAppSelector(selectCustomerInvoices);
  const invoicesLoading = useAppSelector(selectCustomerInvoicesLoading);
  // Same source as the header and avatar badges, so every count matches.
  // Messages card removed (client) — unread count now lives on the header icon:
  // const { unreadMessages } = useCustomerPendingBadge();

  const firstName =
    String(user?.firstName || "").trim() ||
    String(user?.email || "there").split("@")[0];

  const today = useMemo(() => new Date(), []);
  const formattedToday = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(today),
    [today],
  );

  useEffect(() => {
    void dispatch(fetchCustomerOrders({ page: 1, limit: 5 }));
    void dispatch(fetchCustomerEstimates());
    void dispatch(
      fetchCustomerQuoteRequests({
        page: 1,
        limit: CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT,
        force: true,
      }),
    );
    void dispatch(fetchCustomerInvoices());
  }, [dispatch]);

  // Requests card removed (client) — was:
  // const openRequests = useMemo(
  // () =>
  // batches.filter((b) => {
  // const statuses = (b.professionals || []).map((p) =>
  // String(p.status || "").toLowerCase(),
  // );
  // const isClosed =
  // statuses.some((s) => s === "converted_to_job" || s === "accepted") ||
  // (b.professionals.length > 0 &&
  // statuses.every(isDeclinedStatus) &&
  // b.estimateCount === 0);
  // return !isClosed;
  // }).length,
  // [batches],
  // );

  const openOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !["SETTLED", "CANCELLED", "DISPUTED"].includes(
            String(order.status || "").toUpperCase(),
          ),
      ).length,
    [orders],
  );

  const pendingEstimates = useMemo(
    () =>
      estimates.filter((item) =>
        ["sent", "finalized", "changes_requested"].includes(item.status),
      ).length,
    [estimates],
  );

  const openInvoices = useMemo(
    () =>
      invoices.filter((item) =>
        ["sent", "partially_paid", "overdue"].includes(item.status),
      ).length,
    [invoices],
  );

  const invoiceMoney = useMemo(
    () =>
      invoices.reduce(
        (acc, item) => ({
          paid: acc.paid + (Number(item.amountPaid) || 0),
          outstanding:
            acc.outstanding +
            (["sent", "partially_paid", "overdue"].includes(item.status) ? Number(item.balanceDue) || 0 : 0),
        }),
        { paid: 0, outstanding: 0 },
      ),
    [invoices],
  );

  const estimateSegments = useMemo(() => {
    const count = (statuses: string[]) => estimates.filter((item) => statuses.includes(String(item.status))).length;
    const review = count(["sent", "finalized", "changes_requested"]);
    const approved = count(["accepted", "converted_to_job"]);
    const declined = count(["declined", "rejected"]);
    return [
      { label: "To review", value: review, tone: "amber" as const },
      { label: "Approved", value: approved, tone: "emerald" as const },
      { label: "Declined", value: declined, tone: "violet" as const },
      { label: "Other", value: Math.max(0, estimates.length - review - approved - declined), tone: "sky" as const },
    ];
  }, [estimates]);

  const [pendingChangeOrders, setPendingChangeOrders] = useState<
    CustomerChangeOrder[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void listCustomerChangeOrders("pending")
      .then((rows) => {
        if (!cancelled) setPendingChangeOrders(rows);
      })
      .catch(() => {
        if (!cancelled) setPendingChangeOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Advanced overview (client): one "Needs your attention" list + the next booked visit.
  // "Needs your attention" removed (client) — was:
  // const attentionRows = useMemo(
  // () =>
  // buildCustomerActions({
  // estimates,
  // invoices,
  // changeOrders: pendingChangeOrders,
  // unreadMessages,
  // }),
  // [estimates, invoices, pendingChangeOrders, unreadMessages],
  // );
  const dueInvoices = useMemo(
    () => invoices.filter((item) => ["sent", "partially_paid", "overdue"].includes(item.status) && Number(item.balanceDue) > 0).length,
    [invoices],
  );
  const nextVisit: NextVisit = useMemo(() => {
    const now = today.getTime();
    const upcoming = orders
      .filter((order) => {
        const start = order.booking?.startTime ? new Date(order.booking.startTime).getTime() : NaN;
        return Number.isFinite(start) && start >= now && !["SETTLED", "CANCELLED", "DISPUTED"].includes(String(order.status || "").toUpperCase());
      })
      .sort((a, b) => new Date(a.booking!.startTime!).getTime() - new Date(b.booking!.startTime!).getTime())[0];
    if (!upcoming?.booking?.startTime) return null;
    const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
      new Date(upcoming.booking.startTime),
    );
    return { title: orderServiceTitle(upcoming), when, href: customerPaths.order(upcoming.id) };
  }, [orders, today]);

  return (
    <PortalPage
      eyebrow="Dashboard"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      // Next visit sits in the greeting line with a soft pulsing dot (client). Was a KPI card;
      // before that: description={`${formattedToday} · Customer Dashboard`}.
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>{formattedToday}</span>
          {nextVisit ? (
            <Link
              href={nextVisit.href}
              className="group inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/5 py-1 pr-3 pl-2.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
            >
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60 [animation-duration:2s]" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-primary">Next visit</span>
              <span className="truncate">
                {nextVisit.when} · {nextVisit.title}
              </span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> No visits booked yet
            </span>
          )}
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={customerPaths.estimateRequest}>
              <Plus className="size-3.5" />
              Request new quote
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.site}>
              Browse services
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      }
    >
      {/* Client polish: compact soft KPI row (balance + next visit + counts) instead of the dark
          summary band, "Needs your attention" removed, then Active projects (tiles) beside a
          distinct Estimates-to-review queue. Previous: CustomerHeroSummary + CustomerActionCenter +
          five tall MetricCards + list-style CustomerActiveProjects + charts row. */}
      {/* Four essentials only (client). Previous: 7 cards incl. Next visit, Requests, Messages. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CompactStat
          index={0}
          label="Balance due"
          icon={Wallet}
          tone={invoiceMoney.outstanding > 0 ? "amber" : "primary"}
          value={formatMoney(invoiceMoney.outstanding)}
          note={dueInvoices ? `${dueInvoices} invoice${dueInvoices === 1 ? "" : "s"} to pay` : "All paid up"}
          loading={invoicesLoading && !invoices.length}
          href={customerPaths.invoices}
        />
        {/* Next visit → greeting line; Requests → sidebar (client). */}
        <CompactStat
          index={1}
          label="Estimates"
          icon={FileText}
          value={estimates.length}
          note={pendingEstimates ? `${pendingEstimates} to review` : "From your pros"}
          loading={estimatesLoading && !estimates.length}
          href={customerPaths.estimates}
        />
        <CompactStat
          index={2}
          label="Orders"
          icon={ClipboardList}
          value={pagination.totalDocs || orders.length}
          note={openOrders ? `${openOrders} in progress` : "Booked services"}
          loading={ordersLoading && !orders.length}
          href={customerPaths.orders}
        />
        <CompactStat
          index={3}
          label="Invoices"
          icon={Receipt}
          value={invoices.length}
          note={openInvoices ? `${openInvoices} awaiting payment` : "Bills from your pros"}
          loading={invoicesLoading && !invoices.length}
          href={customerPaths.invoices}
        />
        {/* Messages → header icon (client). */}
      </div>

      {pendingChangeOrders.length > 0 ? (
        <Link
          href={
            pendingChangeOrders.length === 1
              ? customerPaths.changeOrder(pendingChangeOrders[0].jobId, pendingChangeOrders[0].id)
              : customerPaths.changeOrders
          }
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 transition hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <span className="size-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
          <span className="font-semibold">
            {pendingChangeOrders.length} change order{pendingChangeOrders.length === 1 ? "" : "s"} need your approval
          </span>
          <span className="text-amber-800 dark:text-amber-200">
            · +{formatMoney(pendingChangeOrders.reduce((sum, co) => sum + (Number(co.amount) || 0), 0))}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold">
            Review <ArrowRight className="size-3.5" />
          </span>
        </Link>
      ) : null}

      <div style={enterStyle(7)} className={`${ENTER_CLASS} grid gap-4 xl:grid-cols-3`}>
        <CustomerActiveProjectCards estimates={estimates} className="xl:col-span-2" />
        <CustomerEstimatesToReview estimates={estimates} loading={estimatesLoading && !estimates.length} />
      </div>

      {/* Spending + estimates insight, right after Active projects (client). */}
      <div style={enterStyle(8)} className={`${ENTER_CLASS} grid gap-4 lg:grid-cols-2`}>
        <SpendingInsight paid={invoiceMoney.paid} outstanding={invoiceMoney.outstanding} />
        <EstimateInsight segments={estimateSegments} />
      </div>

      {/* Previous top area (kept for reference):
      //       {/ * Advanced overview: summary band + one list of what needs the customer. * /}
      //       <CustomerHeroSummary
      //         outstanding={invoiceMoney.outstanding}
      //         dueCount={dueInvoices}
      //         nextVisit={nextVisit}
      //         attentionCount={attentionRows.length}
      //         activeProjects={openOrders}
      //       />
      //       <CustomerActionCenter
      //         rows={attentionRows}
      //         loading={(estimatesLoading && !estimates.length) || (invoicesLoading && !invoices.length)}
      //       />
      // 
      //       {/ * Previous change-orders-only banner — now part of "Needs your attention" above. * /}
      //       {false && pendingChangeOrders.length > 0 ? (
      //         <div
      //           role="status"
      //           className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-amber-200 border-l-4 border-l-orange-500 bg-amber-50/70 px-3 py-2"
      //         >
      //           <span className="relative flex size-2.5 shrink-0" aria-hidden>
      //             <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-500 opacity-75" />
      //             <span className="relative inline-flex size-2.5 rounded-full bg-orange-500" />
      //           </span>
      //           <p className="text-sm text-amber-950">
      //             <span className="font-semibold">
      //               {pendingChangeOrders.length} change order{pendingChangeOrders.length === 1 ? "" : "s"} need your approval
      //             </span>
      //             <span className="text-amber-800">
      //               {" "}
      //               · +{formatMoney(pendingChangeOrders.reduce((sum, co) => sum + (Number(co.amount) || 0), 0))}
      //             </span>
      //           </p>
      //           <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      //             {pendingChangeOrders.slice(0, 3).map((co) => (
      //               <Link
      //                 key={`${co.jobId}-${co.id}`}
      //                 href={customerPaths.changeOrder(co.jobId, co.id)}
      //                 title={co.title || co.description || undefined}
      //                 className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-amber-400 hover:text-slate-900"
      //               >
      //                 <span className="font-semibold">{co.number}</span>
      //                 <span className="text-slate-400">·</span>
      //                 <span>{co.jobNumber || "Job"}</span>
      //                 <span className="font-medium tabular-nums text-amber-800">+{formatMoney(co.amount)}</span>
      //               </Link>
      //             ))}
      //             {pendingChangeOrders.length > 3 ? (
      //               <span className="text-xs text-amber-800">+{pendingChangeOrders.length - 3} more</span>
      //             ) : null}
      //           </div>
      //           <Button size="sm" className="h-7 shrink-0" asChild>
      //             <Link
      //               href={
      //                 pendingChangeOrders.length === 1
      //                   ? customerPaths.changeOrder(pendingChangeOrders[0].jobId, pendingChangeOrders[0].id)
      //                   : customerPaths.changeOrders
      //               }
      //             >
      //               Review
      //               <ArrowRight className="size-3.5" />
      //             </Link>
      //           </Button>
      //         </div>
      //       ) : null}
      // 
      //       {/ * Summary metrics * /}
      //       <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      //         <MetricCard
      //           index={0}
      //           label="Requests"
      //           icon={Inbox}
      //           tone="primary"
      //           value={batches.length}
      //           loading={batchesLoading && !batches.length}
      //           note={openRequests ? `${openRequests} active requests` : "Quote requests sent"}
      //           progress={batches.length ? openRequests / batches.length : 0}
      //           href={customerPaths.requests}
      //         />
      //         <MetricCard
      //           index={1}
      //           label="Estimates"
      //           icon={FileText}
      //           tone="amber"
      //           value={estimates.length}
      //           loading={estimatesLoading && !estimates.length}
      //           note={pendingEstimates ? `${pendingEstimates} awaiting your review` : "Proposals from professionals"}
      //           progress={estimates.length ? pendingEstimates / estimates.length : 0}
      //           href={customerPaths.estimates}
      //         />
      //         <MetricCard
      //           index={2}
      //           label="Orders"
      //           icon={ClipboardList}
      //           tone="sky"
      //           value={pagination.totalDocs || orders.length}
      //           loading={ordersLoading && !orders.length}
      //           note={openOrders ? `${openOrders} in progress` : "Booked fixed services & jobs"}
      //           progress={orders.length ? openOrders / orders.length : 0}
      //           href={customerPaths.orders}
      //         />
      //         <MetricCard
      //           index={3}
      //           label="Invoices"
      //           icon={Receipt}
      //           tone="emerald"
      //           value={invoices.length}
      //           loading={invoicesLoading && !invoices.length}
      //           note={openInvoices ? `${openInvoices} awaiting payment` : "Bills from completed services"}
      //           progress={invoices.length ? 1 - openInvoices / invoices.length : 0}
      //           href={customerPaths.invoices}
      //         />
      //         <MetricCard
      //           index={4}
      //           label="Messages"
      //           icon={MessageCircle}
      //           tone="violet"
      //           value={unreadMessages}
      //           note={unreadMessages ? `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}` : "Chat with professionals"}
      //           href={customerPaths.messages}
      //         />
      //       </div>
      // 
      //       {/ * Ongoing / upcoming work with stage progress * /}
      //       <div style={enterStyle(5)} className={ENTER_CLASS}>
      //         <CustomerActiveProjects estimates={estimates} />
      //       </div>
      // 
      //       {/ * Visual summaries * /}
      //       <div className="grid gap-4 lg:grid-cols-2">
      //         <SpendingCard index={5} paid={invoiceMoney.paid} outstanding={invoiceMoney.outstanding} href={customerPaths.invoices} />
      //         <StatusBreakdownCard
      //           index={6}
      //           title="Estimates"
      //           subtitle="Where your proposals stand"
      //           href={customerPaths.estimates}
      //           segments={estimateSegments}
      //         />
      //       </div>
      // 
      // 
      */}
      {/* Recent activity */}
      <div style={enterStyle(9)} className={`${ENTER_CLASS} grid gap-4 lg:grid-cols-3`}>
        {/* Quote Requests */}
        <BoardCard
          title="Quote requests"
          href={customerPaths.requests}
          hrefLabel="View all"
          empty={
            batchesLoading && !batches.length
              ? "Loading requests…"
              : batches.length
                ? undefined
                : "No quote requests yet. Request an estimate for custom work."
          }
        >
          {batches.slice(0, 4).map((batch) => (
            <Link
              key={batchKey(batch)}
              href={customerPaths.quoteRequest(batchKey(batch))}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {batch.serviceName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {batch.city ? `${batch.city}, ${batch.state}` : "Local request"}
                  {batch.createdAt ? ` · ${formatShortDate(batch.createdAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill
                  label={batchStatusLabel(batch)}
                  tone={batchTone(batch)}
                />
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {batch.estimateCount > 0
                    ? `${batch.estimateCount} quote${batch.estimateCount === 1 ? "" : "s"}`
                    : `${batch.sentToCount} sent`}
                </span>
              </div>
            </Link>
          ))}
        </BoardCard>

        {/* Estimates list moved to <CustomerEstimatesToReview> above (was a 4th BoardCard here). */}
        {/* Recent Orders */}
        <BoardCard
          title="Recent orders"
          href={customerPaths.orders}
          hrefLabel="View all"
          empty={
            ordersLoading && !orders.length
              ? "Loading orders…"
              : orders.length
                ? undefined
                : "No orders yet. Browse services on the marketplace to book a pro."
          }
        >
          {orders.slice(0, 4).map((order) => (
            <Link
              key={order.id}
              href={customerPaths.order(order.id)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {orderServiceTitle(order)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {order.orderNumber || order.id.slice(0, 8)}
                  {order.booking?.startTime
                    ? ` · ${formatShortDate(order.booking.startTime)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill
                  label={formatOrderStatus(order.status)}
                  tone={orderTone(order.status)}
                />
                <span className="font-semibold tabular-nums text-foreground">
                  {formatOrderMoney(
                    order.pricing.totalAmount,
                    order.pricing.currency,
                  )}
                </span>
              </div>
            </Link>
          ))}
        </BoardCard>

        {/* Recent Invoices */}
        <BoardCard
          title="Recent invoices"
          href={customerPaths.invoices}
          hrefLabel="View all"
          empty={
            invoicesLoading && !invoices.length
              ? "Loading invoices…"
              : invoices.length
                ? undefined
                : "No invoices yet. When a professional sends an invoice, it will appear here."
          }
        >
          {invoices.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              href={customerPaths.invoice(item.id)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {item.number}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.provider?.companyName || "Professional"}
                  {item.dueAt ? ` · Due ${formatShortDate(item.dueAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill
                  label={invoiceStatusLabel(item.status)}
                  tone={moneyTone(item.status)}
                />
                <div className="text-right">
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatMoney(item.balanceDue || item.total)}
                  </span>
                  {item.balanceDue && item.balanceDue < item.total ? (
                    <p className="text-[10px] text-muted-foreground">
                      of {formatMoney(item.total)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </BoardCard>
      </div>

      {/* (Charts moved up under Active projects and redesigned — client. Were SpendingCard +
          StatusBreakdownCard here at the bottom.) */}
    </PortalPage>
  );
}
