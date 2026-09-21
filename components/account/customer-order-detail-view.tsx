"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  MapPin,
  Maximize2,
  MessageSquare,
  Package,
  Phone,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { ordersApi } from "@/components/api/ApiRoutesFile";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate } from "@/lib/format";
import {
  formatOrderAddressLine,
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderWindow,
} from "@/lib/orders/order-display";
import {
  formatOrderStatus,
  formatPaymentStatus,
  orderStatusBadgeVariant,
} from "@/lib/orders/order-status";
import type { CustomerOrderDetail } from "@/lib/types/order-booking";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  customerOrderDetailFromListItem,
  fetchCustomerOrderById,
  selectCustomerOrderDetail,
  selectCustomerOrderDetailError,
  selectCustomerOrderDetailLoading,
  selectCustomerOrders,
  setCustomerOrderDetail,
} from "@/store/ordersSlice";

function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

type TimelineStep = {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  current?: boolean;
};

function buildTimelineSteps(order: CustomerOrderDetail): TimelineStep[] {
  const statusUpper = String(order.status || "").toUpperCase();
  const jobStatus = String(order.jobStatus || "").toLowerCase();

  const isConfirmed =
    statusUpper === "CONFIRMED" ||
    jobStatus === "scheduled" ||
    Boolean(order.booking?.startTime);
  const isInTransit =
    ["IN_TRANSIT", "ARRIVED", "IN_PROGRESS", "WORK_COMPLETED", "SETTLED"].includes(
      statusUpper,
    ) ||
    [
      "dispatched",
      "en_route",
      "on_site",
      "in_progress",
      "completed",
      "invoiced",
      "paid",
    ].includes(jobStatus);
  const isInProgress =
    ["IN_PROGRESS", "WORK_COMPLETED", "SETTLED"].includes(statusUpper) ||
    ["in_progress", "completed", "invoiced", "paid"].includes(jobStatus);
  const isCompleted =
    ["WORK_COMPLETED", "SETTLED"].includes(statusUpper) ||
    ["completed", "invoiced", "paid"].includes(jobStatus);
  const isSettled =
    statusUpper === "SETTLED" || ["invoiced", "paid"].includes(jobStatus);

  return [
    {
      id: "placed",
      label: "Order placed",
      detail: order.createdAt ? formatDate(order.createdAt) : undefined,
      done: true,
      current: statusUpper === "BOOKING_REQUESTED" || jobStatus === "unscheduled",
    },
    {
      id: "scheduled",
      label: "Scheduled",
      detail: order.booking?.startTime
        ? formatOrderDateTime(order.booking.startTime)
        : undefined,
      done: isConfirmed || isInTransit,
      current: statusUpper === "CONFIRMED" || jobStatus === "scheduled",
    },
    {
      id: "transit",
      label: "En route & on site",
      detail:
        statusUpper === "ARRIVED" || jobStatus === "on_site"
          ? "Professional on site"
          : undefined,
      done: isInTransit,
      current:
        ["IN_TRANSIT", "ARRIVED"].includes(statusUpper) ||
        ["dispatched", "en_route", "on_site"].includes(jobStatus),
    },
    {
      id: "in_progress",
      label: "Work in progress",
      detail: isInProgress ? "Service active" : undefined,
      done: isInProgress,
      current: statusUpper === "IN_PROGRESS" || jobStatus === "in_progress",
    },
    {
      id: "completed",
      label: "Completed",
      detail:
        order.completionDetails?.completedAt
          ? formatDate(order.completionDetails.completedAt)
          : undefined,
      done: isCompleted,
      current: statusUpper === "WORK_COMPLETED" || jobStatus === "completed",
    },
    {
      id: "settled",
      label: "Invoiced & settled",
      detail: isSettled ? "Billing finalized" : undefined,
      done: isSettled,
      current: isSettled,
    },
  ];
}

function CustomerOrderActions({
  orderId,
  status,
  onDone,
}: {
  orderId: string;
  status: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [rating, setRating] = useState("5");
  const [review, setReview] = useState("");
  const upper = String(status || "").toUpperCase();
  const canDispute = ["IN_PROGRESS", "WORK_COMPLETED", "ON_HOLD"].includes(
    upper,
  );
  const canSignOff = upper === "WORK_COMPLETED";

  if (!canDispute && !canSignOff) return null;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onDone();
    } catch (error) {
      showApiErrorToast(error, "Could not update this order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Order actions
      </h3>

      {canSignOff ? (
        <div className="mt-4 space-y-2.5 border-b border-border pb-4">
          <p className="text-sm font-semibold text-foreground">
            Confirm work completion
          </p>
          <p className="text-xs text-muted-foreground">
            Sign off to approve work completion and authorize balance release.
          </p>
          <Input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            aria-label="Rating"
            placeholder="Rating (1-5)"
            className="h-8.5 text-xs"
          />
          <Input
            value={review}
            onChange={(event) => setReview(event.target.value)}
            aria-label="Review"
            placeholder="Optional review or feedback"
            className="h-8.5 text-xs"
          />
          <Button
            size="sm"
            className="w-full gap-1.5"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  postData(ordersApi.signOff(orderId), {
                    rating: Number(rating) || 5,
                    review: review.trim(),
                    tip: 0,
                  }),
                "Thank you! Work sign-off completed.",
              )
            }
          >
            <Check className="size-3.5" />
            Complete sign-off
          </Button>
        </div>
      ) : null}

      {canDispute ? (
        <div className={cn("space-y-2.5", canSignOff ? "mt-4 border-t border-border pt-4" : "mt-4")}>
          <p className="text-sm font-semibold text-foreground">
            Report an issue
          </p>
          <p className="text-xs text-muted-foreground">
            If work quality does not match the agreement, flag for support
            review.
          </p>
          <Input
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
            placeholder="Describe the issue in detail"
            aria-label="Dispute reason"
            className="h-8.5 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy || disputeReason.trim().length < 5}
            onClick={() =>
              void run(
                () =>
                  postData(ordersApi.dispute(orderId), {
                    reason: disputeReason.trim(),
                  }),
                "Issue submitted to support for review.",
              )
            }
          >
            Open dispute
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CustomerOrderDetailView({
  orderId,
}: {
  orderId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const order = useAppSelector(selectCustomerOrderDetail);
  const list = useAppSelector(selectCustomerOrders);
  const loading = useAppSelector(selectCustomerOrderDetailLoading);
  const error = useAppSelector(selectCustomerOrderDetailError);
  const nextPath = customerPaths.order(orderId);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const activeOrder = useMemo(() => {
    if (order?.id === orderId) return order;
    return null;
  }, [order, orderId]);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.hydrated, isAuthenticated, router, nextPath]);

  useEffect(() => {
    if (!auth.hydrated || !isAuthenticated || !orderId) return;

    // Instant paint from list card if cached
    if (order?.id !== orderId) {
      const fromList = list.find((item) => item.id === orderId);
      if (fromList) {
        dispatch(
          setCustomerOrderDetail(customerOrderDetailFromListItem(fromList)),
        );
      }
    }

    // Enrich with full order detail
    void dispatch(fetchCustomerOrderById(orderId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.hydrated, isAuthenticated, orderId, dispatch]);

  // Consolidate all images (service images, proof of work, attachments)
  const allImages = useMemo<string[]>(() => {
    if (!activeOrder) return [];
    const set = new Set<string>();
    const list: string[] = [];
    const add = (url?: unknown) => {
      if (!url || typeof url !== "string") return;
      const clean = url.trim();
      if (clean && !set.has(clean)) {
        set.add(clean);
        list.push(clean);
      }
    };

    (activeOrder.service?.images || []).forEach(add);
    (activeOrder.completionDetails?.proofOfWorkImages || []).forEach(add);

    return list;
  }, [activeOrder]);

  // Keyboard navigation for lightbox modal
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxIndex(null);
      } else if (event.key === "ArrowLeft") {
        setLightboxIndex((prev) =>
          prev !== null ? (prev - 1 + allImages.length) % allImages.length : 0,
        );
      } else if (event.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev !== null ? (prev + 1) % allImages.length : 0,
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, allImages.length]);

  const timelineSteps = useMemo(() => {
    return activeOrder ? buildTimelineSteps(activeOrder) : [];
  }, [activeOrder]);

  if (!auth.hydrated || loading || (!activeOrder && !error)) {
    return (
      <PortalPage
        eyebrow="Activity"
        title="Order details"
        description="Review schedule, status, and work progress for your service order."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.orders}>
              <ArrowLeft className="size-3.5" />
              All orders
            </Link>
          </Button>
        }
      >
        <div className="flex min-h-[360px] items-center justify-center">
          <CenteredSpinner label="Loading order details…" />
        </div>
      </PortalPage>
    );
  }

  if (error && !activeOrder) {
    return (
      <PortalPage
        eyebrow="Activity"
        title="Order not found"
        description="Could not locate the requested order."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.orders}>
              <ArrowLeft className="size-3.5" />
              All orders
            </Link>
          </Button>
        }
      >
        <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-12 text-center">
          <p className="text-base font-semibold text-foreground">
            Couldn’t load this order
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => void dispatch(fetchCustomerOrderById(orderId))}
          >
            Try again
          </Button>
        </div>
      </PortalPage>
    );
  }

  if (!activeOrder) return null;

  const title = activeOrder.service?.title || "Professional Service Order";
  const addressLine = formatOrderAddressLine(activeOrder.address);
  const pricing = activeOrder.pricing;
  const covered = activeOrder.service?.covered?.filter(Boolean) ?? [];
  const provider = activeOrder.provider;
  const websiteUrl = provider?.website
    ? normalizeWebsiteUrl(provider.website)
    : "";
  const isProService = activeOrder.orderType === "pro_service";
  const items = activeOrder.items || [];

  return (
    <>
      <PortalPage
        eyebrow="Activity"
        title={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>{activeOrder.orderNumber}</span>
            <span className="text-muted-foreground/50 font-normal">·</span>
            <span className="font-medium text-foreground">{title}</span>
          </div>
        }
        description={`Booked service with ${provider?.companyName || "Service Professional"}. Open any section for schedule, scope, and direct communications.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={customerPaths.orders}>
                <ArrowLeft className="size-3.5" />
                All orders
              </Link>
            </Button>

            {activeOrder.estimateId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={customerPaths.estimate(activeOrder.estimateId)}>
                  <FileText className="size-3.5" />
                  View estimate
                </Link>
              </Button>
            ) : null}

            {activeOrder.invoiceId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={customerPaths.invoice(activeOrder.invoiceId)}>
                  <Receipt className="size-3.5" />
                  View invoice
                </Link>
              </Button>
            ) : null}

            <Button asChild size="sm">
              <Link href={customerPaths.messages}>
                <MessageSquare className="size-3.5" />
                Message provider
              </Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* TOP METRICS / STATS BAR */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {/* 1. Order Total */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Order total
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {formatOrderMoney(pricing.totalAmount, pricing.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pricing.changeOrdersTotal
                  ? `Includes ${formatOrderMoney(pricing.changeOrdersTotal, pricing.currency)} change orders`
                  : "Total contract value"}
              </p>
            </div>

            {/* 2. Status */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Current status
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  variant={orderStatusBadgeVariant(activeOrder.status)}
                  className="px-2.5 py-1 text-xs font-semibold"
                >
                  {formatOrderStatus(activeOrder.status)}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground capitalize">
                {activeOrder.jobStatus
                  ? `Job status: ${activeOrder.jobStatus.replace(/_/g, " ")}`
                  : isProService
                    ? "Professional Service Work Order"
                    : "Direct Fixed Service Order"}
              </p>
            </div>

            {/* 3. Appointment Window */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Schedule window
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground sm:text-base">
                {activeOrder.booking?.startTime
                  ? formatOrderWindow(
                      activeOrder.booking.startTime,
                      activeOrder.booking.endTime,
                    )
                  : "To be scheduled"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeOrder.createdAt
                  ? `Ordered ${formatDate(activeOrder.createdAt)}`
                  : "Active order"}
              </p>
            </div>

            {/* 4. Provider */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Provider
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground sm:text-base">
                {provider?.companyName || "Service Provider"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                Verified Professional
              </p>
            </div>
          </div>

          {/* PROGRESS STEPPER */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Order lifecycle & progress
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Real-time status updates from scheduling to work completion
                    and final billing
                  </p>
                </div>
                <Badge
                  variant={isProService ? "secondary" : "outline"}
                  className="font-mono text-[11px]"
                >
                  {isProService ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3 text-primary" />
                      Pro Service Job
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3 text-primary" />
                      Fixed Service Order
                    </span>
                  )}
                </Badge>
              </div>
            </div>

            <div className="mt-6">
              <ol className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {timelineSteps.map((step, idx) => (
                  <li key={step.id} className="relative flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          step.done
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : step.current
                              ? "border-2 border-primary bg-background text-primary"
                              : "border border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {step.done ? (
                          <Check className="size-3.5 stroke-[2.5]" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          step.done || step.current
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {step.detail ? (
                      <p className="mt-1 pl-8 text-[11px] text-muted-foreground">
                        {step.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* MAIN 2-COLUMN GRID */}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* LEFT COLUMN: Specifications, Items Table, Team, Attachments, Logs */}
            <div className="space-y-6">
              {/* SECTION 1: Service Specifications & Scope Breakdown */}
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
                <div className="border-b border-border pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Service specifications & scope
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      Ref: {activeOrder.orderNumber}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Scope details, task specifications, and itemized billing
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Service Header card */}
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-base">
                        {title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {activeOrder.service?.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {activeOrder.service.category}
                          </Badge>
                        ) : null}
                        {activeOrder.service?.unit ? (
                          <Badge variant="outline" className="text-xs capitalize">
                            Unit: {activeOrder.service.unit}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Contract Base
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-foreground">
                        {formatOrderMoney(
                          pricing.basePrice ?? pricing.totalAmount,
                          pricing.currency,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Customer Notes / Special Instructions */}
                  {activeOrder.customerNotes || activeOrder.address?.notes ? (
                    <div>
                      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Work instructions & customer specifications
                      </h3>
                      <div className="mt-2 rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {activeOrder.customerNotes || activeOrder.address?.notes}
                      </div>
                    </div>
                  ) : null}

                  {/* Itemized Table (When items exist from Pro Job or detailed scope) */}
                  {items.length > 0 ? (
                    <div className="mt-5 space-y-2">
                      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Itemized service tasks & materials ({items.length})
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">#</th>
                              <th className="px-4 py-3">Description</th>
                              <th className="px-4 py-3">Kind</th>
                              <th className="px-4 py-3 text-right">Qty</th>
                              <th className="px-4 py-3 text-right">Unit Price</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {items.map((item, idx) => (
                              <tr
                                key={item.id || item._id || idx}
                                className="transition-colors hover:bg-muted/30"
                              >
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {item.description}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="outline"
                                    className="capitalize text-[11px]"
                                  >
                                    {item.kind || "service"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs">
                                  {item.quantity ?? 1}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs">
                                  {item.unitPrice != null
                                    ? formatOrderMoney(
                                        item.unitPrice,
                                        pricing.currency,
                                      )
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-foreground">
                                  {item.total != null
                                    ? formatOrderMoney(
                                        item.total,
                                        pricing.currency,
                                      )
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-border bg-muted/20 font-medium">
                            <tr>
                              <td colSpan={5} className="px-4 py-2.5 text-right text-xs">
                                Scope Subtotal:
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-foreground">
                                {formatOrderMoney(
                                  pricing.subtotal ?? pricing.basePrice ?? pricing.totalAmount,
                                  pricing.currency,
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {/* Covered Items Checklist */}
                  {covered.length > 0 && items.length === 0 ? (
                    <div className="mt-4 space-y-2">
                      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Included package services
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {covered.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground"
                          >
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Attached Photos / Proof of Work Gallery */}
                  {allImages.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                          <ImageIcon className="size-3.5 text-primary" />
                          Attached photos & proof of work ({allImages.length})
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          Click to enlarge
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                        {allImages.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxIndex(idx)}
                            className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted/40 transition-all hover:border-primary/60 hover:shadow-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                            title="View full image"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`Order photo ${idx + 1}`}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                              <div className="rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <Maximize2 className="size-3.5" />
                              </div>
                            </div>
                            <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-mono text-white">
                              {idx + 1}/{allImages.length}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* SECTION 2: Assigned Field Team & Technicians */}
              {(activeOrder.assignedEmployees &&
                activeOrder.assignedEmployees.length > 0) ||
              (activeOrder.assignedContractors &&
                activeOrder.assignedContractors.length > 0) ? (
                <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-base font-semibold text-foreground">
                      Assigned service personnel
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Technicians and certified specialists assigned to execute
                      this order
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {activeOrder.assignedEmployees?.map((emp) => (
                      <div
                        key={emp.id || emp._id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3.5"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {emp.firstName?.charAt(0) ||
                            emp.name?.charAt(0) ||
                            "T"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm">
                            {emp.name ||
                              `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                              "Technician"}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {emp.role || "Lead Specialist"}
                          </p>
                          {emp.phone ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {emp.phone}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {activeOrder.assignedContractors?.map((con) => (
                      <div
                        key={con.id || con._id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3.5"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold text-sm">
                          <Wrench className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm">
                            {con.companyName || con.name || "Contractor"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Subcontract Partner
                          </p>
                          {con.phone ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {con.phone}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* SECTION 3: Change Orders */}
              {activeOrder.changeOrders.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-base font-semibold text-foreground">
                      Change orders & scope adjustments
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Modifications or extra work requested during service
                      execution
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeOrder.changeOrders.map((co) => (
                      <div
                        key={co.id}
                        className="rounded-lg border border-border bg-muted/20 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-foreground text-sm">
                            {co.description}
                          </p>
                          <Badge
                            variant={
                              co.status === "APPROVED"
                                ? "default"
                                : co.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {co.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Requested:{" "}
                            {co.requestedAt
                              ? formatDate(co.requestedAt)
                              : "During work"}
                          </span>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            +
                            {formatOrderMoney(
                              co.additionalAmount,
                              pricing.currency,
                            )}
                          </span>
                        </div>
                        {co.customerNote ? (
                          <p className="mt-2 text-xs italic text-muted-foreground">
                            Customer note: {co.customerNote}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* SECTION 4: Activity & Progress History */}
              {activeOrder.lifecycleAudit.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-base font-semibold text-foreground">
                      Activity & event log
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Audit trail of milestones, status changes, and technician
                      updates
                    </p>
                  </div>

                  <ol className="mt-5 space-y-4">
                    {activeOrder.lifecycleAudit.map((entry, idx) => (
                      <li
                        key={`${entry.toStatus}-${entry.timestamp}-${idx}`}
                        className="relative flex items-start gap-3 pl-2"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Clock className="size-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {entry.toStatus.replace(/_/g, " ")}
                            </p>
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatOrderDateTime(entry.timestamp)}
                            </span>
                          </div>
                          {entry.notes ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {entry.notes}
                            </p>
                          ) : null}
                          {entry.triggeredBy ? (
                            <p className="mt-1 text-[11px] text-muted-foreground/80">
                              Logged by: {entry.triggeredBy}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>

            {/* RIGHT SIDEBAR: Financial Summary, Quick CTAs, Appointment, Location, Provider */}
            <aside className="space-y-5 lg:sticky lg:top-20">
              {/* Financial Summary Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Order financial summary
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-primary">
                  {formatOrderMoney(pricing.totalAmount, pricing.currency)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Order #{activeOrder.orderNumber}
                </p>

                <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                  <div className="flex justify-between gap-3 text-muted-foreground">
                    <span>Base amount:</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatOrderMoney(
                        pricing.basePrice ?? pricing.totalAmount,
                        pricing.currency,
                      )}
                    </span>
                  </div>

                  {pricing.changeOrdersTotal ? (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>Change orders:</span>
                      <span className="font-mono font-medium text-foreground">
                        +
                        {formatOrderMoney(
                          pricing.changeOrdersTotal,
                          pricing.currency,
                        )}
                      </span>
                    </div>
                  ) : null}

                  {pricing.taxAmount ? (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>Taxes:</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatOrderMoney(pricing.taxAmount, pricing.currency)}
                      </span>
                    </div>
                  ) : null}

                  {pricing.platformFee ? (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>Platform fee:</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatOrderMoney(pricing.platformFee, pricing.currency)}
                      </span>
                    </div>
                  ) : null}

                  {activeOrder.payment?.status ? (
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-muted-foreground">
                      <span>Payment status:</span>
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {formatPaymentStatus(activeOrder.payment.status)}
                      </Badge>
                    </div>
                  ) : null}
                </div>

                {/* Quick links to Estimate / Invoice */}
                {(activeOrder.invoiceId || activeOrder.estimateId) && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    {activeOrder.invoiceId ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs"
                      >
                        <Link href={customerPaths.invoice(activeOrder.invoiceId)}>
                          <Receipt className="size-3.5 text-primary" />
                          View formal customer invoice
                        </Link>
                      </Button>
                    ) : null}
                    {activeOrder.estimateId ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs"
                      >
                        <Link href={customerPaths.estimate(activeOrder.estimateId)}>
                          <FileText className="size-3.5 text-primary" />
                          View accepted proposal estimate
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Appointment / Timing Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  <CalendarDays className="size-3.5 text-primary" />
                  Service schedule & timing
                </h3>
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Scheduled for:</span>
                    <p className="font-medium text-foreground text-sm mt-0.5">
                      {activeOrder.booking?.startTime
                        ? formatOrderWindow(
                            activeOrder.booking.startTime,
                            activeOrder.booking.endTime,
                          )
                        : "To be coordinated with provider"}
                    </p>
                  </div>
                  {activeOrder.createdAt ? (
                    <div className="border-t border-border pt-2 text-muted-foreground">
                      <span>Date requested:</span>{" "}
                      <span className="font-medium text-foreground">
                        {formatOrderDateTime(activeOrder.createdAt)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Service Location Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  <MapPin className="size-3.5 text-primary" />
                  Service address
                </h3>
                <div className="mt-3 text-xs">
                  <p className="font-medium text-foreground text-sm">
                    {addressLine || "Address on file"}
                  </p>
                  {activeOrder.address?.notes ? (
                    <p className="mt-2 rounded bg-muted/40 p-2 text-muted-foreground">
                      Gate / Entry: {activeOrder.address.notes}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Provider Business Profile Card */}
              {provider ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Service professional
                  </h3>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                      {provider.avatarUrl ? (
                        <Image
                          src={provider.avatarUrl}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                          unoptimized={provider.avatarUrl.startsWith("http")}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground font-semibold">
                          {provider.companyName?.charAt(0) || "P"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        {provider.companyName}
                      </p>
                      {provider.phone ? (
                        <a
                          href={`tel:${provider.phone}`}
                          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="size-3" />
                          {provider.phone}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <Button asChild size="sm" className="w-full gap-1.5">
                      <Link href={customerPaths.messages}>
                        <MessageSquare className="size-3.5" />
                        Message provider
                      </Link>
                    </Button>

                    {websiteUrl ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs"
                      >
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="size-3.5" />
                          Company website
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Order Actions (Sign-off, Cancel, Dispute) */}
              <CustomerOrderActions
                orderId={activeOrder.id}
                status={activeOrder.status}
                onDone={() => void dispatch(fetchCustomerOrderById(orderId))}
              />
            </aside>
          </div>
        </div>
      </PortalPage>

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {lightboxIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Image Preview"
              onClick={() => setLightboxIndex(null)}
            >
              {/* Top bar */}
              <div
                className="absolute top-4 inset-x-4 flex items-center justify-between z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                  {lightboxIndex + 1} of {allImages.length}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                  aria-label="Close image preview"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Navigation buttons */}
              {allImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) =>
                        prev !== null
                          ? (prev - 1 + allImages.length) % allImages.length
                          : 0,
                      );
                    }}
                    className="absolute left-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) =>
                        prev !== null ? (prev + 1) % allImages.length : 0,
                      );
                    }}
                    className="absolute right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              ) : null}

              {/* Main Image */}
              <div
                className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={allImages[lightboxIndex]}
                  alt={`Order preview ${lightboxIndex + 1}`}
                  className="max-h-[85vh] max-w-[90vw] object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
