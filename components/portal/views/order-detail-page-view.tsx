"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Info,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AcceptOrderModal,
  ArriveOrderModal,
  CancelOrderModal,
  ChangeOrderModal,
  CompleteWorkModal,
  RejectOrderModal,
  StartWorkOrderModal,
  TransitOrderModal,
} from "@/components/portal/orders/order-action-modals";
import {
  formatOrderStatus,
  formatPaymentStatus,
  OrderStatusPill,
} from "@/components/portal/orders/order-status-pill";
import { RecordWorkspace, type RecordTab } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { ProviderOrder } from "@/lib/types/provider-order";
import {
  acceptProviderOrder,
  arriveProviderOrder,
  cancelProviderOrder,
  clearProviderOrdersError,
  completeProviderOrder,
  fetchProviderOrderById,
  proposeChangeOrder,
  rejectProviderOrder,
  startWorkProviderOrder,
  transitProviderOrder,
} from "@/store/providerOrdersSlice";

function Fact({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function SoftPanel({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border-soft bg-card",
        className,
      )}
    >
      {title ? (
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border-soft px-4 py-2.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Change Orders tab: always shows loading, list, or empty — never a blank panel. */
function ChangeOrdersTabPanel({
  order,
  loading,
  onPropose,
  proposeDisabled,
}: {
  order: ProviderOrder;
  loading: boolean;
  onPropose: () => void;
  proposeDisabled: boolean;
}) {
  const changeOrders = Array.isArray(order.changeOrders)
    ? order.changeOrders
    : [];
  const canPropose =
    order.status === "IN_PROGRESS" || order.status === "ARRIVED";

  if (loading) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-soft bg-muted/40 px-4 py-8">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm font-medium text-foreground">
          Loading change orders…
        </p>
        <p className="text-xs text-muted-foreground">
          Fetching the latest scope modifications for this order.
        </p>
      </div>
    );
  }

  if (changeOrders.length > 0) {
    return (
      <div className="divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-card">
        {changeOrders.map((co, index) => (
          <div key={co.id || `co-${index}`} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">
                {co.description || `Change Order #${index + 1}`}
              </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                +${Number(co.additionalAmount || 0).toFixed(2)}
              </span>
            </div>
            {co.reason ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span>{" "}
                {co.reason}
              </p>
            ) : null}
            <div className="flex items-center gap-3 pt-1 text-xs">
              <StatusPill
                label={formatOrderStatus(co.status || "PENDING")}
                tone={
                  co.status === "APPROVED"
                    ? "success"
                    : co.status === "REJECTED"
                      ? "danger"
                      : "warning"
                }
              />
              {co.createdAt ? (
                <span className="text-muted-foreground">
                  Submitted {formatDate(co.createdAt)}
                </span>
              ) : null}
            </div>
            {co.evidencePhotos && co.evidencePhotos.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {co.evidencePhotos.map((photo, pIdx) => (
                  <a
                    key={`${co.id || index}-photo-${pIdx}`}
                    href={photo}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block size-16 overflow-hidden rounded-md border border-border-soft bg-muted hover:opacity-85"
                  >
                    <Image
                      src={photo}
                      alt="Evidence"
                      fill
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border-soft bg-muted/30 px-4 py-8 text-center">
      <p className="text-sm font-medium text-foreground">
        No change orders for this order yet
      </p>
      <p className="mx-auto max-w-md text-xs text-muted-foreground">
        {canPropose
          ? "In-field scope changes and extra parts will appear here after you propose them."
          : order.status === "BOOKING_REQUESTED" ||
              order.status === "CONFIRMED" ||
              order.status === "IN_TRANSIT"
            ? "Change orders become available after you arrive on site and start work."
            : "No change orders have been proposed for this order."}
      </p>
      {canPropose ? (
        <Button
          size="sm"
          className="mt-1 h-8 gap-1.5"
          onClick={onPropose}
          disabled={proposeDisabled}
        >
          <FileEdit className="size-3.5" />
          + Propose Change Order
        </Button>
      ) : null}
    </div>
  );
}

function formatSlotWindow(
  startTime?: string,
  endTime?: string,
  duration?: number,
) {
  if (!startTime) return null;
  const start = new Date(startTime);
  if (isNaN(start.getTime())) return null;
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  let endStr = "";
  if (endTime) {
    const end = new Date(endTime);
    if (!isNaN(end.getTime())) {
      endStr = ` – ${end.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
  }
  const durationStr = duration ? ` (${duration} mins)` : "";
  return `${dateStr} at ${timeStr}${endStr}${durationStr}`;
}

function getOrderStageBanner(status: string) {
  switch (status) {
    case "BOOKING_REQUESTED":
      return {
        tone: "border-blue-200 bg-blue-50/80 text-blue-950",
        message:
          "New inbound booking request. Review the scope, scheduled slot, and location, then accept to confirm or decline if unavailable.",
      };
    case "CONFIRMED":
      return {
        tone: "border-blue-200 bg-blue-50/80 text-blue-950",
        message:
          "Order is confirmed on your schedule. When ready to travel to the customer's property, click Depart to start GPS departure logging.",
      };
    case "IN_TRANSIT":
      return {
        tone: "border-amber-200 bg-amber-50/80 text-amber-950",
        message:
          "You are en route to the property. When arrived on site, click Arrive to verify the 200m geofence location.",
      };
    case "ARRIVED":
      return {
        tone: "border-purple-200 bg-purple-50/80 text-purple-950",
        message:
          "Arrival on site verified. Click Start Work when ready to commence physical service execution.",
      };
    case "IN_PROGRESS":
      return {
        tone: "border-purple-200 bg-purple-50/80 text-purple-950",
        message:
          "Service work is currently in progress. If unexpected scope or parts are needed, propose a change order. When finished, submit work completion with photos.",
      };
    case "CHANGE_ORDER_PENDING":
      return {
        tone: "border-amber-200 bg-amber-50/80 text-amber-950",
        message:
          "Change order proposed and awaiting customer approval. Work may resume once customer signs off or declines the additional scope.",
      };
    case "WORK_COMPLETED":
      return {
        tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
        message:
          "Work completion and photo proof recorded. Awaiting customer sign-off and final payment settlement.",
      };
    case "SETTLED":
      return {
        tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
        message:
          "Service order successfully completed and settled. Payout has been released.",
      };
    case "CANCELLED":
      return {
        tone: "border-red-200 bg-red-50/80 text-red-950",
        message: "This order has been cancelled. The time slot is released.",
      };
    default:
      return {
        tone: "border-border-soft bg-secondary text-foreground",
        message: "Operational service work order.",
      };
  }
}

export function OrderDetailPageView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const {
    selectedOrder: selectedOrder,
    selectedLoading: loading,
    actionLoading,
    error,
    detailsCache = {},
  } = useAppSelector((state) => state.providerOrders);

  const cachedOrder = detailsCache?.[id];
  const displayOrder =
    selectedOrder?.id === id
      ? selectedOrder
      : cachedOrder?.id === id
        ? cachedOrder
        : null;

  const [activeModal, setActiveModal] = useState<
    | "accept"
    | "reject"
    | "transit"
    | "arrive"
    | "startWork"
    | "changeOrder"
    | "complete"
    | "cancel"
    | null
  >(null);
  /** idle → loading → ready. Change Orders shows spinner until ready when empty. */
  const [detailLoadState, setDetailLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const refreshOrder = useCallback(async () => {
    if (!id) return;
    setDetailLoadState((prev) => (prev === "ready" ? "ready" : "loading"));
    // Always mark loading when we have no change-order rows yet so the tab isn't blank.
    const cached = detailsCache?.[id];
    const hasChangeOrders =
      (Array.isArray(cached?.changeOrders) && cached!.changeOrders!.length > 0) ||
      (selectedOrder?.id === id &&
        Array.isArray(selectedOrder.changeOrders) &&
        selectedOrder.changeOrders.length > 0);
    if (!hasChangeOrders) setDetailLoadState("loading");
    try {
      await dispatch(fetchProviderOrderById(id)).unwrap();
      setDetailLoadState("ready");
    } catch {
      setDetailLoadState("error");
      // Error toast handled via slice error effect.
    }
  }, [dispatch, id, detailsCache, selectedOrder]);

  // Soft load by order id (inner tabs share the same detail GET response).
  useEffect(() => {
    if (!id) return;
    setDetailLoadState("loading");
    void refreshOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when order id changes
  }, [id]);

  useEffect(() => {
    if (error && !loading) {
      toast.error(error);
      dispatch(clearProviderOrdersError());
    }
  }, [dispatch, error, loading]);

  const handleRefresh = () => {
    if (id) {
      refreshOrder();
      toast.success("Order refreshed.");
    }
  };

  const handleAccept = async () => {
    if (!displayOrder) return;
    const res = await dispatch(acceptProviderOrder(displayOrder.id));
    if (acceptProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleReject = async (reason: string) => {
    if (!displayOrder) return;
    const res = await dispatch(
      rejectProviderOrder({
        id: displayOrder.id,
        reason,
        rejectionReason: reason,
      }),
    );
    if (rejectProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleTransit = async (coords: [number, number]) => {
    if (!displayOrder) return;
    const res = await dispatch(
      transitProviderOrder({
        id: displayOrder.id,
        startCoordinates: coords,
      }),
    );
    if (transitProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleArrive = async (coords: [number, number]) => {
    if (!displayOrder) return;
    const res = await dispatch(
      arriveProviderOrder({
        id: displayOrder.id,
        coordinates: coords,
      }),
    );
    if (arriveProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleStartWork = async () => {
    if (!displayOrder) return;
    const res = await dispatch(startWorkProviderOrder(displayOrder.id));
    if (startWorkProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleChangeOrder = async (payload: {
    description: string;
    reason: string;
    additionalAmount: number;
    evidencePhotos: string[];
  }) => {
    if (!displayOrder) return;
    const res = await dispatch(
      proposeChangeOrder({
        id: displayOrder.id,
        ...payload,
      }),
    );
    if (proposeChangeOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      await refreshOrder();
    }
  };

  const handleComplete = async (payload: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }) => {
    if (!displayOrder) return;
    const res = await dispatch(
      completeProviderOrder({
        id: displayOrder.id,
        ...payload,
      }),
    );
    if (completeProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  const handleCancel = async (reason: string) => {
    if (!displayOrder) return;
    const res = await dispatch(
      cancelProviderOrder({
        id: displayOrder.id,
        reason,
      }),
    );
    if (cancelProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(displayOrder.id));
    }
  };

  if (loading && !displayOrder) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!displayOrder || displayOrder.id !== id) {
    return (
      <div className="rounded-md border border-border-soft bg-card p-6">
        <h1 className="text-lg font-semibold">Order not found</h1>
        <Button asChild className="mt-4 h-8" size="sm">
          <Link href="/pro/dashboard/orders">Back to fixed service orders</Link>
        </Button>
      </div>
    );
  }

  const order = displayOrder;

  const coords = order.address?.location?.coordinates;
  const mapsUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.address?.street}, ${order.address?.city}, ${order.address?.state} ${order.address?.zip}`,
      )}`;

  const isActionLoading = Boolean(actionLoading[order.id]);
  const serviceTitle =
    order.service?.title || order.service?.servicesName || "Service Order";
  const orderLabel =
    order.orderNumber || order.id.slice(-8).toUpperCase();
  const payoutTotal = `$${order.pricing?.totalAmount?.toFixed(2) || "0.00"}`;
  const payoutCurrency = order.pricing?.currency || "USD";
  const slotLabel = order.booking?.startTime
    ? formatSlotWindow(
        order.booking.startTime,
        order.booking.endTime,
        order.booking.durationMinutes,
      )
    : null;

  const tabs: RecordTab[] = [
    { id: "summary", label: "Summary" },
    { id: "service", label: "Service Scope" },
    { id: "customer", label: "Customer" },
    {
      id: "change_orders",
      label: `Change Orders (${order.changeOrders?.length || 0})`,
    },
    { id: "completion", label: "Completion & Proof" },
    { id: "financials", label: "Financials" },
  ];

  const banner = getOrderStageBanner(order.status);

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/orders/${order.id}`}
        label={`${orderLabel} · ${serviceTitle}`}
        kind="order"
        tabs={tabs}
        subnavTabs={["change_orders", "completion"]}
        subnav={(activeTab) => {
          if (activeTab === "change_orders") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Change Orders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In-field scope modifications and additional parts.
                  </p>
                </div>
                {order.status === "IN_PROGRESS" || order.status === "ARRIVED" ? (
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => setActiveModal("changeOrder")}
                    disabled={isActionLoading}
                  >
                    <FileEdit className="size-3.5" />
                    + Propose Change Order
                  </Button>
                ) : null}
              </div>
            );
          }
          if (activeTab === "completion") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Completion & Proof
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completion notes, proof photos, and customer sign-off.
                  </p>
                </div>
                {order.status === "IN_PROGRESS" ? (
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setActiveModal("complete")}
                    disabled={isActionLoading}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Submit Work Completion
                  </Button>
                ) : null}
              </div>
            );
          }
          return null;
        }}
        badge={<OrderStatusPill status={order.status} full />}
        actions={
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 border-border-soft text-xs"
            >
              <Link href="/pro/dashboard/orders">
                <ArrowLeft className="size-3.5" /> Back to fixed service orders
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading && !order}
              className="h-8 gap-1.5 border-border-soft text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading && !order ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {order.status === "BOOKING_REQUESTED" ? (
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => setActiveModal("accept")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" /> Accept Booking
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setActiveModal("reject")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <XCircle className="size-3.5" /> Decline
                </Button>
              </div>
            ) : null}

            {order.status === "CONFIRMED" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setActiveModal("transit")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Navigation className="size-3.5" /> Depart
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("cancel")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
                >
                  <AlertCircle className="size-3.5" /> Cancel
                </Button>
              </>
            )}

            {order.status === "IN_TRANSIT" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setActiveModal("arrive")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 bg-amber-600 text-xs font-medium text-white hover:bg-amber-700"
                >
                  <MapPin className="size-3.5" /> Arrive On-Site
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("cancel")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
                >
                  <AlertCircle className="size-3.5" /> Cancel
                </Button>
              </>
            )}

            {order.status === "ARRIVED" && (
              <Button
                size="sm"
                onClick={() => setActiveModal("startWork")}
                disabled={isActionLoading}
                className="h-8 gap-1.5 bg-purple-600 text-xs font-medium text-white hover:bg-purple-700"
              >
                <Play className="size-3.5" /> Start Work
              </Button>
            )}

            {order.status === "IN_PROGRESS" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setActiveModal("complete")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" /> Complete Work
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("changeOrder")}
                  disabled={isActionLoading}
                  className="h-8 gap-1.5 border-border-soft text-xs"
                >
                  <FileEdit className="size-3.5" /> + Change Order
                </Button>
              </>
            )}
          </div>
        }
      >
        {(currentTab) => {
          switch (currentTab) {
            case "summary":
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-soft pb-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        Order summary
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                        {serviceTitle}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {orderLabel}
                        {order.service?.category
                          ? ` · ${order.service.category}${
                              order.service.subcategory
                                ? ` / ${order.service.subcategory}`
                                : ""
                            }`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-md bg-secondary px-3 py-2 text-right">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Payout total
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {payoutTotal}{" "}
                        <span className="text-xs font-medium text-muted-foreground">
                          {payoutCurrency}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm",
                      banner.tone,
                    )}
                  >
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>{banner.message}</span>
                  </div>

                  {slotLabel ? (
                    <div className="rounded-md bg-sky-50 px-4 py-2.5 text-sm">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-sky-800 uppercase">
                        Scheduled appointment
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-sky-950">
                        <Clock className="size-3.5 shrink-0" />
                        {slotLabel}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-5">
                    <SoftPanel
                      title="Service & payout"
                      className="lg:col-span-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Fact label="Service" value={serviceTitle} />
                        <Fact
                          label="Category"
                          value={
                            order.service?.category
                              ? `${order.service.category}${
                                  order.service.subcategory
                                    ? ` · ${order.service.subcategory}`
                                    : ""
                                }`
                              : "—"
                          }
                        />
                        <Fact
                          label="Total Payout"
                          value={`${payoutTotal} ${payoutCurrency}`}
                        />
                        <Fact
                          label="Payment Status"
                          value={formatPaymentStatus(order.payment?.status)}
                        />
                        <Fact label="Order Number" value={orderLabel} />
                        <Fact
                          label="Created At"
                          value={formatDate(order.createdAt)}
                        />
                      </div>
                      {order.service?.covered?.length ? (
                        <div className="mt-4 space-y-2 border-t border-border-soft pt-3">
                          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                            Covered In Scope
                          </p>
                          <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                            {order.service.covered.map((item, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-foreground"
                              >
                                <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </SoftPanel>

                    <SoftPanel title="At a glance" className="lg:col-span-2">
                      <div className="space-y-3">
                        <div className="rounded-md bg-secondary/70 px-3 py-3">
                          <p className="text-xs text-muted-foreground">Customer</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {order.customer?.name || "Property Owner"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Full contact and site details are on the Customer tab.
                          </p>
                        </div>
                        <div className="rounded-md bg-secondary/70 px-3 py-3">
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {order.address?.city || "—"}
                            {order.address?.state
                              ? `, ${order.address.state}`
                              : ""}
                          </p>
                          {order.address?.street ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {order.address.street}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </SoftPanel>
                  </div>
                </div>
              );

            case "service":
              return (
                <div className="space-y-4">
                  <SoftPanel title="Service Package Overview">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Fact label="Service Title" value={serviceTitle} />
                      <Fact
                        label="Category"
                        value={order.service?.category || "—"}
                      />
                      <Fact
                        label="Subcategory"
                        value={order.service?.subcategory || "—"}
                      />
                      <Fact
                        label="Base Price"
                        value={`$${order.service?.basePrice?.toFixed(2) || order.pricing?.basePrice?.toFixed(2) || "0.00"}`}
                      />
                      <Fact
                        label="Billing Unit"
                        value={order.service?.unit || "per visit"}
                      />
                    </div>
                  </SoftPanel>

                  <SoftPanel title="Included Work & Coverage">
                    {order.service?.covered?.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {order.service.covered.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-md bg-secondary/70 px-3 py-2 text-xs"
                          >
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                            <span className="font-medium text-foreground">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Standard operational service scope applies.
                      </p>
                    )}
                  </SoftPanel>

                  {order.service?.images?.length ? (
                    <SoftPanel title="Package Photos">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {order.service.images.map((src, i) => (
                          <div
                            key={i}
                            className="relative aspect-video overflow-hidden rounded-md border border-border-soft bg-muted"
                          >
                            <Image
                              src={src}
                              alt={`Service Photo ${i + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </SoftPanel>
                  ) : null}
                </div>
              );

            case "customer":
              return (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SoftPanel title="Customer Contact">
                      <div className="space-y-3">
                        <Fact
                          label="Full Name"
                          value={order.customer?.name || "Customer"}
                        />
                        <Fact
                          label="Phone"
                          value={
                            order.customer?.phone ? (
                              <a
                                href={`tel:${order.customer.phone}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <Phone className="size-3.5" />{" "}
                                {order.customer.phone}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />
                        <Fact
                          label="Email"
                          value={
                            order.customer?.email ? (
                              <a
                                href={`mailto:${order.customer.email}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <Mail className="size-3.5" />{" "}
                                {order.customer.email}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </div>
                    </SoftPanel>

                    <SoftPanel
                      title="Property Location"
                      action={
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="size-3" />
                        </a>
                      }
                    >
                      <div className="space-y-3">
                        <Fact
                          label="Street Address"
                          value={
                            order.address?.street
                              ? `${order.address.street}${
                                  order.address.unit
                                    ? ` (Unit ${order.address.unit})`
                                    : ""
                                }`
                              : "—"
                          }
                        />
                        <Fact
                          label="City, State, Zip"
                          value={`${order.address?.city || ""}, ${order.address?.state || ""} ${order.address?.zip || ""}`}
                        />
                        <Fact
                          label="GPS Coordinates"
                          value={
                            coords
                              ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`
                              : "Not recorded"
                          }
                        />
                        {coords ? (
                          <div className="flex items-center gap-2 rounded-md bg-secondary/70 px-2.5 py-2 font-mono text-xs text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0 text-blue-600" />
                            <span>
                              [{coords[0].toFixed(5)}, {coords[1].toFixed(5)}]
                            </span>
                            <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                              200m Geofence
                            </span>
                          </div>
                        ) : null}
                        {order.address?.notes ? (
                          <Fact
                            label="Site Access Notes"
                            value={order.address.notes}
                          />
                        ) : null}
                      </div>
                    </SoftPanel>
                  </div>
                </div>
              );

            case "change_orders": {
              const changeOrders = Array.isArray(order.changeOrders)
                ? order.changeOrders
                : [];
              const showLoading =
                detailLoadState !== "ready" &&
                detailLoadState !== "error" &&
                changeOrders.length === 0;
              return (
                <ChangeOrdersTabPanel
                  order={order}
                  loading={showLoading}
                  onPropose={() => setActiveModal("changeOrder")}
                  proposeDisabled={isActionLoading}
                />
              );
            }

            case "completion":
              return (
                <div className="space-y-4">
                  <SoftPanel title="Work Completion Summary">
                    <p className="text-sm text-foreground">
                      {order.completionDetails?.completionNotes ||
                        order.completionDetails?.notes ||
                        "No completion notes recorded yet."}
                    </p>
                    {order.completionDetails?.completedAt ? (
                      <p className="pt-2 text-xs text-muted-foreground">
                        Completed at:{" "}
                        {formatDate(order.completionDetails.completedAt)}
                      </p>
                    ) : null}
                  </SoftPanel>

                  <div className="grid gap-4 md:grid-cols-2">
                    <SoftPanel title="Before Work Photos">
                      {order.completionDetails?.beforePhotos?.length ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          {order.completionDetails.beforePhotos.map(
                            (img, i) => (
                              <a
                                key={i}
                                href={img}
                                target="_blank"
                                rel="noreferrer"
                                className="relative block aspect-video overflow-hidden rounded-md border border-border-soft bg-muted hover:opacity-85"
                              >
                                <Image
                                  src={img}
                                  alt={`Before photo ${i + 1}`}
                                  fill
                                  className="object-cover"
                                />
                              </a>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No before photos.
                        </p>
                      )}
                    </SoftPanel>

                    <SoftPanel title="After Proof-of-Work Photos">
                      {order.completionDetails?.afterPhotos?.length ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          {order.completionDetails.afterPhotos.map(
                            (img, i) => (
                              <a
                                key={i}
                                href={img}
                                target="_blank"
                                rel="noreferrer"
                                className="relative block aspect-video overflow-hidden rounded-md border border-border-soft bg-muted hover:opacity-85"
                              >
                                <Image
                                  src={img}
                                  alt={`After photo ${i + 1}`}
                                  fill
                                  className="object-cover"
                                />
                              </a>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No after photos recorded.
                        </p>
                      )}
                    </SoftPanel>
                  </div>

                  <SoftPanel title="Customer Sign-off & Review">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Fact
                        label="Customer Sign-off"
                        value={
                          order.completionDetails?.customerSignOff?.confirmed
                            ? "Signed & Confirmed"
                            : "Awaiting Sign-off"
                        }
                      />
                      <Fact
                        label="Customer Rating"
                        value={
                          order.completionDetails?.customerSignOff?.rating
                            ? `${order.completionDetails.customerSignOff.rating} / 5 Stars`
                            : "—"
                        }
                      />
                      <Fact
                        label="Tip Added"
                        value={
                          order.completionDetails?.customerSignOff?.tip
                            ? `$${order.completionDetails.customerSignOff.tip.toFixed(2)}`
                            : "$0.00"
                        }
                      />
                    </div>
                    {order.completionDetails?.customerSignOff?.review ? (
                      <div className="border-t border-border-soft pt-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Review:{" "}
                        </span>
                        {order.completionDetails.customerSignOff.review}
                      </div>
                    ) : null}
                  </SoftPanel>
                </div>
              );

            case "financials":
              return (
                <div className="max-w-xl space-y-4">
                  <SoftPanel title="Financial Breakdown">
                    <div className="divide-y divide-border-soft text-xs">
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">
                          Base Service Price
                        </span>
                        <span className="font-mono font-medium">
                          ${order.pricing?.basePrice?.toFixed(2) || "0.00"}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">
                          Change Orders Approved
                        </span>
                        <span className="font-mono font-medium">
                          +$
                          {order.pricing?.changeOrdersTotal?.toFixed(2) ||
                            "0.00"}
                        </span>
                      </div>

                      <div className="flex justify-between py-2 font-medium">
                        <span className="text-foreground">Subtotal</span>
                        <span className="font-mono">
                          ${order.pricing?.subtotal?.toFixed(2) || "0.00"}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">
                          Estimated Tax{" "}
                          {order.pricing?.taxRate
                            ? `(${order.pricing.taxRate}%)`
                            : ""}
                        </span>
                        <span className="font-mono font-medium">
                          ${order.pricing?.taxAmount?.toFixed(2) || "0.00"}
                        </span>
                      </div>

                      {order.pricing?.platformFee ? (
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">
                            Platform Fee
                          </span>
                          <span className="font-mono font-medium">
                            -${order.pricing.platformFee.toFixed(2)}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
                        <span className="font-semibold text-foreground">
                          Total Payout
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                          {payoutTotal} {payoutCurrency}
                        </span>
                      </div>
                    </div>
                  </SoftPanel>

                  <SoftPanel title="Payment Authorization">
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      <Fact
                        label="Payment Status"
                        value={formatPaymentStatus(order.payment?.status)}
                      />
                      <Fact
                        label="Hold Identifier"
                        value={
                          <span className="font-mono text-xs">
                            {order.payment?.authorizationHoldId ||
                              "ch_hold_authorized"}
                          </span>
                        }
                      />
                    </div>
                  </SoftPanel>
                </div>
              );

            default:
              return null;
          }
        }}
      </RecordWorkspace>

      <AcceptOrderModal
        order={order}
        isOpen={activeModal === "accept"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleAccept}
        loading={isActionLoading}
      />

      <RejectOrderModal
        order={order}
        isOpen={activeModal === "reject"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleReject}
        loading={isActionLoading}
      />

      <TransitOrderModal
        order={order}
        isOpen={activeModal === "transit"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleTransit}
        loading={isActionLoading}
      />

      <ArriveOrderModal
        order={order}
        isOpen={activeModal === "arrive"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleArrive}
        loading={isActionLoading}
      />

      <StartWorkOrderModal
        order={order}
        isOpen={activeModal === "startWork"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleStartWork}
        loading={isActionLoading}
      />

      <ChangeOrderModal
        order={order}
        isOpen={activeModal === "changeOrder"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleChangeOrder}
        loading={isActionLoading}
      />

      <CompleteWorkModal
        order={order}
        isOpen={activeModal === "complete"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleComplete}
        loading={isActionLoading}
      />

      <CancelOrderModal
        order={order}
        isOpen={activeModal === "cancel"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleCancel}
        loading={isActionLoading}
      />
    </>
  );
}
