"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileEdit,
  FileText,
  Info,
  LayoutDashboard,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  UserRound,
  Wrench,
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
  getOrderStatusTone,
  OrderStatusPill,
} from "@/components/portal/orders/order-status-pill";
import { RecordWorkspace, type RecordTab } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
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
import type { ProviderOrder } from "@/lib/types/provider-order";

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
        tone: "border-black/10 bg-[#e8eef5] text-[#003F7D]",
        message: "Operational service work order.",
      };
  }
}

export function OrderDetailPageView({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    selectedOrder: order,
    selectedLoading: loading,
    actionLoading,
    error,
  } = useAppSelector((state) => state.providerOrders);

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

  useEffect(() => {
    if (id) {
      void dispatch(fetchProviderOrderById(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (error && !loading) {
      toast.error(error);
      dispatch(clearProviderOrdersError());
    }
  }, [dispatch, error, loading]);

  const handleRefresh = () => {
    if (id) {
      void dispatch(fetchProviderOrderById(id));
      toast.success("Order refreshed.");
    }
  };

  const handleAccept = async () => {
    if (!order) return;
    const res = await dispatch(acceptProviderOrder(order.id));
    if (acceptProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleReject = async (reason: string) => {
    if (!order) return;
    const res = await dispatch(
      rejectProviderOrder({
        id: order.id,
        reason,
        rejectionReason: reason,
      }),
    );
    if (rejectProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleTransit = async (coords: [number, number]) => {
    if (!order) return;
    const res = await dispatch(
      transitProviderOrder({
        id: order.id,
        startCoordinates: coords,
      }),
    );
    if (transitProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleArrive = async (coords: [number, number]) => {
    if (!order) return;
    const res = await dispatch(
      arriveProviderOrder({
        id: order.id,
        coordinates: coords,
      }),
    );
    if (arriveProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleStartWork = async () => {
    if (!order) return;
    const res = await dispatch(startWorkProviderOrder(order.id));
    if (startWorkProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleChangeOrder = async (payload: {
    description: string;
    reason: string;
    additionalAmount: number;
    evidencePhotos: string[];
  }) => {
    if (!order) return;
    const res = await dispatch(
      proposeChangeOrder({
        id: order.id,
        ...payload,
      }),
    );
    if (proposeChangeOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleComplete = async (payload: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }) => {
    if (!order) return;
    const res = await dispatch(
      completeProviderOrder({
        id: order.id,
        ...payload,
      }),
    );
    if (completeProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  const handleCancel = async (reason: string) => {
    if (!order) return;
    const res = await dispatch(
      cancelProviderOrder({
        id: order.id,
        reason,
      }),
    );
    if (cancelProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
      void dispatch(fetchProviderOrderById(order.id));
    }
  };

  if (loading && !order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">Order not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/orders">Back to Orders</Link>
        </Button>
      </div>
    );
  }

  const coords = order.address?.location?.coordinates;
  const mapsUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.address?.street}, ${order.address?.city}, ${order.address?.state} ${order.address?.zip}`,
      )}`;

  const isActionLoading = Boolean(actionLoading[order.id]);

  const tabs: RecordTab[] = [
    { id: "summary", label: "Summary", icon: LayoutDashboard },
    { id: "service", label: "Service Scope", icon: Wrench },
    { id: "customer", label: "Customer & Site", icon: UserRound },
    {
      id: "change_orders",
      label: `Change Orders (${order.changeOrders?.length || 0})`,
      icon: FileEdit,
    },
    { id: "completion", label: "Completion & Proof", icon: FileCheck2 },
    { id: "financials", label: "Financials", icon: CreditCard },
  ];

  const banner = getOrderStageBanner(order.status);

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/orders/${order.id}`}
        label={`${order.orderNumber || order.id.slice(-8).toUpperCase()} · ${order.service?.title || order.service?.servicesName || "Service Order"}`}
        kind="order"
        tabs={tabs}
        badge={
          <OrderStatusPill status={order.status} full />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 h-8 text-xs"
            >
              <Link href="/pro/dashboard/orders">
                <ArrowLeft className="size-3.5" /> Back to Orders
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-1.5 h-8 text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {/* Contextual Action Buttons in Header */}
            {order.status === "BOOKING_REQUESTED" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setActiveModal("accept")}
                  disabled={isActionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                >
                  <CheckCircle2 className="size-3.5" /> Accept Booking
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setActiveModal("reject")}
                  disabled={isActionLoading}
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  <XCircle className="size-3.5" /> Decline
                </Button>
              </>
            )}

            {order.status === "CONFIRMED" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setActiveModal("transit")}
                  disabled={isActionLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs font-medium"
                >
                  <Navigation className="size-3.5" /> Depart
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("cancel")}
                  disabled={isActionLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 text-xs"
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
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs font-medium"
                >
                  <MapPin className="size-3.5" /> Arrive On-Site
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("cancel")}
                  disabled={isActionLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 text-xs"
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
                className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-8 text-xs font-medium"
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                >
                  <CheckCircle2 className="size-3.5" /> Complete Work
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveModal("changeOrder")}
                  disabled={isActionLoading}
                  className="gap-1.5 h-8 text-xs"
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
            // ==========================================
            // TAB 1: SUMMARY
            // ==========================================
            case "summary":
              return (
                <div className="space-y-4">
                  {/* Breadcrumb */}
                  <nav
                    aria-label="Order breadcrumb"
                    className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground"
                  >
                    <Link
                      href="/pro/dashboard/orders"
                      className="font-semibold text-primary hover:underline"
                    >
                      Orders
                    </Link>
                    <span>/</span>
                    <span className="font-medium text-foreground">
                      {order.orderNumber || order.id.slice(-8).toUpperCase()} –{" "}
                      {order.service?.title || order.service?.servicesName || "Service"}
                    </span>
                  </nav>

                  {/* Operational Stage Banner */}
                  <div
                    className={cn(
                      "rounded-[4px] border px-4 py-3 text-sm flex items-center justify-between gap-4",
                      banner.tone,
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Info className="size-4 shrink-0 mt-0.5" />
                      <span>{banner.message}</span>
                    </div>
                  </div>

                  {/* Scheduled Appointment Slot Card */}
                  {order.booking?.startTime &&
                  formatSlotWindow(
                    order.booking.startTime,
                    order.booking.endTime,
                    order.booking.durationMinutes,
                  ) ? (
                    <div className="rounded-[4px] border border-blue-200 bg-blue-50/50 p-3.5 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                        <Clock className="size-4 text-blue-600" /> Scheduled Appointment Window
                      </div>
                      <p className="text-blue-950 font-medium text-sm mt-1">
                        {formatSlotWindow(
                          order.booking.startTime,
                          order.booking.endTime,
                          order.booking.durationMinutes,
                        )}
                      </p>
                    </div>
                  ) : null}

                  {/* 2-Column Grid Layout matching portal standard */}
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                    {/* Left Column: Service & Operational Facts */}
                    <div className="grid gap-3 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
                      <Fact
                        label="Service"
                        value={order.service?.title || order.service?.servicesName || "—"}
                      />
                      <Fact
                        label="Category"
                        value={
                          order.service?.category
                            ? `${order.service.category}${order.service.subcategory ? ` · ${order.service.subcategory}` : ""}`
                            : "—"
                        }
                      />
                      <Fact
                        label="Total Payout"
                        value={`$${order.pricing?.totalAmount?.toFixed(2) || "0.00"} ${order.pricing?.currency || "USD"}`}
                      />
                      <Fact
                        label="Payment Status"
                        value={formatPaymentStatus(order.payment?.status)}
                      />
                      <Fact
                        label="Order Number"
                        value={order.orderNumber || order.id.slice(-8).toUpperCase()}
                      />
                      <Fact
                        label="Created At"
                        value={formatDate(order.createdAt)}
                      />

                      {/* Covered items checklist */}
                      {order.service?.covered?.length ? (
                        <div className="sm:col-span-2 space-y-2 pt-2 border-t border-black/5">
                          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                            Covered In Scope
                          </p>
                          <ul className="grid gap-1.5 sm:grid-cols-2 text-xs">
                            {order.service.covered.map((item, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-foreground"
                              >
                                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {/* Right Column: Customer & Property Location */}
                    <div className="space-y-4">
                      {/* Customer Card */}
                      <div className="rounded-[4px] border border-black/10 p-4">
                        <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                          Customer
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {order.customer?.name || "Property Owner"}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {order.customer?.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="size-3 text-primary" />
                              <a
                                href={`tel:${order.customer.phone}`}
                                className="text-primary hover:underline"
                              >
                                {order.customer.phone}
                              </a>
                            </div>
                          ) : null}
                          {order.customer?.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail className="size-3 text-primary" />
                              <a
                                href={`mailto:${order.customer.email}`}
                                className="text-primary hover:underline"
                              >
                                {order.customer.email}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Property Address Card */}
                      <div className="rounded-[4px] border border-black/10 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                            Service Location
                          </p>
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {order.address?.street}
                          {order.address?.unit ? ` (Unit ${order.address.unit})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.address?.city}
                          {order.address?.state ? `, ${order.address.state}` : ""}
                          {order.address?.zip ? ` ${order.address.zip}` : ""}
                        </p>

                        {coords ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-[#f8fafc] px-2 py-1.5 rounded border border-black/5 mt-2">
                            <MapPin className="size-3.5 text-blue-600 shrink-0" />
                            <span>
                              [{coords[0].toFixed(5)}, {coords[1].toFixed(5)}]
                            </span>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded ml-auto">
                              200m Geofence
                            </span>
                          </div>
                        ) : null}

                        {order.address?.notes ? (
                          <div className="pt-2 border-t border-black/5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Access Notes: </span>
                            {order.address.notes}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );

            // ==========================================
            // TAB 2: SERVICE SCOPE
            // ==========================================
            case "service":
              return (
                <div className="space-y-6">
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-4">
                    <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                      Service Package Overview
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Fact
                        label="Service Title"
                        value={order.service?.title || order.service?.servicesName || "—"}
                      />
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
                  </div>

                  {/* Covered Scope Checklist */}
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                    <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                      Included Work & Coverage
                    </h2>
                    {order.service?.covered?.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {order.service.covered.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-[4px] bg-[#f8fafc] px-3 py-2 text-xs"
                          >
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-foreground">{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Standard operational service scope applies.
                      </p>
                    )}
                  </div>

                  {/* Service Images */}
                  {order.service?.images?.length ? (
                    <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                      <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                        Package Photos
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {order.service.images.map((src, i) => (
                          <div
                            key={i}
                            className="relative aspect-video rounded border overflow-hidden bg-muted"
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
                    </div>
                  ) : null}
                </div>
              );

            // ==========================================
            // TAB 3: CUSTOMER & SITE
            // ==========================================
            case "customer":
              return (
                <div className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Customer Profile */}
                    <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                      <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                        Customer Contact Information
                      </h2>
                      <div className="space-y-2 pt-1">
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
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <Phone className="size-3.5" /> {order.customer.phone}
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
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <Mail className="size-3.5" /> {order.customer.email}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Property Location */}
                    <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                          Property Location
                        </h2>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>

                      <div className="space-y-2 pt-1">
                        <Fact
                          label="Street Address"
                          value={
                            order.address?.street
                              ? `${order.address.street}${order.address.unit ? ` (Unit ${order.address.unit})` : ""}`
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
                        {order.address?.notes ? (
                          <Fact
                            label="Site Access Notes"
                            value={order.address.notes}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );

            // ==========================================
            // TAB 4: CHANGE ORDERS
            // ==========================================
            case "change_orders":
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight">
                        Proposed Change Orders
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        In-field scope modifications and additional parts approved by the customer.
                      </p>
                    </div>

                    {order.status === "IN_PROGRESS" ? (
                      <Button
                        size="sm"
                        onClick={() => setActiveModal("changeOrder")}
                        className="gap-1.5 text-xs"
                      >
                        <FileEdit className="size-3.5" /> + Propose Change Order
                      </Button>
                    ) : null}
                  </div>

                  {order.changeOrders?.length ? (
                    <div className="divide-y rounded-[4px] border border-black/10">
                      {order.changeOrders.map((co, index) => (
                        <div key={co.id || index} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">
                              {co.description || `Change Order #${index + 1}`}
                            </span>
                            <span className="font-mono font-semibold text-sm text-foreground">
                              +${co.additionalAmount?.toFixed(2) || "0.00"}
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

                          {co.evidencePhotos?.length ? (
                            <div className="pt-2 flex flex-wrap gap-2">
                              {co.evidencePhotos.map((photo, pIdx) => (
                                <a
                                  key={pIdx}
                                  href={photo}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="relative size-16 rounded border overflow-hidden bg-muted block hover:opacity-85"
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
                  ) : (
                    <div className="rounded-[4px] border border-black/10 bg-[#f8fafc] p-6 text-center text-xs text-muted-foreground space-y-2">
                      <p>No change orders have been proposed for this order.</p>
                      {order.status === "IN_PROGRESS" ? (
                        <p className="text-foreground">
                          Discover extra work on site? Click{" "}
                          <button
                            type="button"
                            onClick={() => setActiveModal("changeOrder")}
                            className="text-primary font-medium underline"
                          >
                            Propose Change Order
                          </button>{" "}
                          to submit a request to the customer.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              );

            // ==========================================
            // TAB 5: COMPLETION & PROOF
            // ==========================================
            case "completion":
              return (
                <div className="space-y-6">
                  {order.status === "IN_PROGRESS" ? (
                    <div className="flex items-center justify-between border-b border-black/10 pb-4">
                      <div>
                        <h2 className="text-sm font-semibold">Finish Service</h2>
                        <p className="text-xs text-muted-foreground">
                          Submit completion notes and photos to trigger customer sign-off.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setActiveModal("complete")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-medium"
                      >
                        <CheckCircle2 className="size-3.5" /> Submit Work Completion
                      </Button>
                    </div>
                  ) : null}

                  {/* Completion Notes */}
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-2">
                    <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                      Work Completion Summary
                    </h2>
                    <p className="text-sm text-foreground">
                      {order.completionDetails?.completionNotes ||
                        order.completionDetails?.notes ||
                        "No completion notes recorded yet."}
                    </p>
                    {order.completionDetails?.completedAt ? (
                      <p className="text-xs text-muted-foreground pt-1">
                        Completed at: {formatDate(order.completionDetails.completedAt)}
                      </p>
                    ) : null}
                  </div>

                  {/* Proof Photos: Before & After */}
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Before Photos */}
                    <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Before Work Photos
                      </h3>
                      {order.completionDetails?.beforePhotos?.length ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          {order.completionDetails.beforePhotos.map((img, i) => (
                            <a
                              key={i}
                              href={img}
                              target="_blank"
                              rel="noreferrer"
                              className="relative aspect-video rounded border overflow-hidden bg-muted block hover:opacity-85"
                            >
                              <Image
                                src={img}
                                alt={`Before photo ${i + 1}`}
                                fill
                                className="object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No before photos.</p>
                      )}
                    </div>

                    {/* After Photos */}
                    <div className="rounded-[4px] border border-black/10 p-4 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        After Proof-of-Work Photos
                      </h3>
                      {order.completionDetails?.afterPhotos?.length ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          {order.completionDetails.afterPhotos.map((img, i) => (
                            <a
                              key={i}
                              href={img}
                              target="_blank"
                              rel="noreferrer"
                              className="relative aspect-video rounded border overflow-hidden bg-muted block hover:opacity-85"
                            >
                              <Image
                                src={img}
                                alt={`After photo ${i + 1}`}
                                fill
                                className="object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No after photos recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* Customer Sign-off Status */}
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-2">
                    <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                      Customer Sign-off & Review
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3 pt-1">
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
                      <div className="pt-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Review: </span>
                        {order.completionDetails.customerSignOff.review}
                      </div>
                    ) : null}
                  </div>
                </div>
              );

            // ==========================================
            // TAB 6: FINANCIALS
            // ==========================================
            case "financials":
              return (
                <div className="space-y-6 max-w-xl">
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-4">
                    <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                      Financial Breakdown & Ledger
                    </h2>

                    <div className="divide-y text-xs">
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Base Service Price</span>
                        <span className="font-mono font-medium">
                          ${order.pricing?.basePrice?.toFixed(2) || "0.00"}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Change Orders Approved</span>
                        <span className="font-mono font-medium">
                          +${order.pricing?.changeOrdersTotal?.toFixed(2) || "0.00"}
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
                          {order.pricing?.taxRate ? `(${order.pricing.taxRate}%)` : ""}
                        </span>
                        <span className="font-mono font-medium">
                          ${order.pricing?.taxAmount?.toFixed(2) || "0.00"}
                        </span>
                      </div>

                      {order.pricing?.platformFee ? (
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">Platform Fee</span>
                          <span className="font-mono font-medium">
                            -${order.pricing.platformFee.toFixed(2)}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex justify-between py-3 font-semibold text-sm border-t-2 border-black/10">
                        <span className="text-foreground">Total Payout</span>
                        <span className="font-mono text-primary">
                          ${order.pricing?.totalAmount?.toFixed(2) || "0.00"}{" "}
                          {order.pricing?.currency || "USD"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Hold Status */}
                  <div className="rounded-[4px] border border-black/10 p-4 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Payment Authorization Details
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 pt-1 text-xs">
                      <Fact
                        label="Payment Status"
                        value={formatPaymentStatus(order.payment?.status)}
                      />
                      <Fact
                        label="Hold Identifier"
                        value={
                          <span className="font-mono text-xs">
                            {order.payment?.authorizationHoldId || "ch_hold_authorized"}
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>
              );

            default:
              return null;
          }
        }}
      </RecordWorkspace>

      {/* Action Modals */}
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
