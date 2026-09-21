"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import {
  BoardCard,
  StatCell,
  dashboardGreeting,
} from "@/components/portal/dashboard-widgets";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { listPublicChatThreads } from "@/lib/api/chat-client";
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
    return `${batch.estimateCount} Estimate${batch.estimateCount === 1 ? "" : "s"}`;
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

function estimateStatusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "converted_to_job") return "Job Created";
  if (clean === "site_visit") return "Site Visit";
  if (clean === "changes_requested") return "Changes Requested";
  if (clean === "sent" || clean === "finalized") return "Ready to Review";
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
  const [unreadMessages, setUnreadMessages] = useState(0);

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
    void dispatch(fetchCustomerQuoteRequests());
    void dispatch(fetchCustomerInvoices());
  }, [dispatch]);

  useEffect(() => {
    const email = String(user?.email || "").trim();
    if (!email) return;
    let cancelled = false;
    void (async () => {
      try {
        const threads = await listPublicChatThreads(email, { silent: true });
        if (!cancelled) {
          setUnreadMessages(
            threads.reduce(
              (sum, thread) => sum + (thread.unreadForCustomer || 0),
              0,
            ),
          );
        }
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const openRequests = useMemo(
    () =>
      batches.filter((b) => {
        const statuses = (b.professionals || []).map((p) =>
          String(p.status || "").toLowerCase(),
        );
        const isClosed =
          statuses.some((s) => s === "converted_to_job" || s === "accepted") ||
          (b.professionals.length > 0 &&
            statuses.every(isDeclinedStatus) &&
            b.estimateCount === 0);
        return !isClosed;
      }).length,
    [batches],
  );

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

  return (
    <PortalPage
      eyebrow="Overview"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formattedToday} · Customer Dashboard`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={customerPaths.estimateRequest}>
              <Plus className="size-3.5" />
              Request new estimate
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
      {/* Provider Portal StatCell Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCell
          label="Requests"
          value={String(batchesLoading ? "…" : batches.length)}
          note={
            openRequests
              ? `${openRequests} active requests`
              : "Quote requests sent"
          }
          href={customerPaths.requests}
        />
        <StatCell
          label="Estimates"
          value={String(estimatesLoading ? "…" : estimates.length)}
          note={
            pendingEstimates
              ? `${pendingEstimates} awaiting your review`
              : "Proposals from professionals"
          }
          href={customerPaths.estimates}
        />
        <StatCell
          label="Orders"
          value={String(ordersLoading ? "…" : pagination.totalDocs || orders.length)}
          note={
            openOrders
              ? `${openOrders} in progress`
              : "Booked fixed services & jobs"
          }
          href={customerPaths.orders}
        />
        <StatCell
          label="Invoices"
          value={String(invoicesLoading ? "…" : invoices.length)}
          note={
            openInvoices
              ? `${openInvoices} awaiting payment`
              : "Bills from completed services"
          }
          href={customerPaths.invoices}
        />
        <StatCell
          label="Messages"
          value={String(unreadMessages)}
          note={
            unreadMessages
              ? `${unreadMessages} unread conversations`
              : "Chat with professionals"
          }
          href={customerPaths.messages}
        />
      </div>

      {/* Provider Portal BoardCard Grid */}
      <div className="grid gap-6 xl:grid-cols-2">
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
          {batches.slice(0, 5).map((batch) => (
            <Link
              key={batchKey(batch)}
              href={customerPaths.quoteRequest(batchKey(batch))}
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
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

        {/* Estimates to Review */}
        <BoardCard
          title="Estimates to review"
          href={customerPaths.estimates}
          hrefLabel="View all"
          empty={
            estimatesLoading && !estimates.length
              ? "Loading estimates…"
              : estimates.length
                ? undefined
                : "No estimates yet. Request a quote to receive proposals."
          }
        >
          {estimates.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={
                item.shareToken
                  ? customerPaths.estimate(item.shareToken)
                  : customerPaths.estimates
              }
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {item.title || item.number || "Estimate"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.provider?.companyName || "Service Professional"}
                  {item.createdAt ? ` · ${formatShortDate(item.createdAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill
                  label={estimateStatusLabel(item.status)}
                  tone={moneyTone(item.status)}
                />
                <span className="font-semibold tabular-nums text-foreground">
                  {item.total ? formatMoney(item.total) : "—"}
                </span>
              </div>
            </Link>
          ))}
        </BoardCard>

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
          {orders.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href={customerPaths.order(order.id)}
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
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
          {invoices.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={customerPaths.invoice(item.id)}
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
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
    </PortalPage>
  );
}
