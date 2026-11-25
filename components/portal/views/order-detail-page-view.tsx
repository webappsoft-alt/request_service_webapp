"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { formatTaxRatePercent } from "@/lib/tax/state-tax";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  FilePlus2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Info,
  Mail,
  MapPin,
  Phone,
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
import { orderStatusAsJob } from "@/components/portal/orders/crew-work-list";
import { JobStatusPill } from "@/components/technician/tech-ui";
import {
  CrewCompletionBanner,
  CrewOrderClockCard,
  OrderCrewActions,
  OrderCrewCard,
  OrderInvoiceAction,
} from "@/components/portal/orders/order-crew";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { ChangeOrderRequestDialog } from "@/components/contractor/change-order-request-dialog";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { crewAcceptOrderScope, crewCompleteOrder, crewOrderScopeRequest } from "@/lib/api/order-crew-client";
import { CompleteJobDialog } from "@/components/contractor/complete-job-dialog";
import { FieldExtraWork } from "@/components/contractor/field-change-orders";
import type { ContractorJobChangeOrder } from "@/lib/api/contractor-portal-client";
import type { ProviderChangeOrderItem } from "@/lib/types/provider-order";
import { OrderRequestsTab, orderPendingRequests } from "@/components/portal/orders/order-requests-tab";
import { OrderChangeOrdersTable } from "@/components/portal/orders/order-change-orders-table";
import { RecordWorkspace, type RecordTab } from "@/components/portal/record-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
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
  getOrderApiScope,
  proposeChangeOrder,
  setOrderApiScope,
  type OrderApiScope,
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
  rows,
  loading,
  onPropose,
  proposeLabel = "+ Propose Change Order",
  proposeDisabled,
}: {
  order: ProviderOrder;
  /** Rows to list (Pro: customer change orders; crew: theirs + customer ones). Defaults to all. */
  rows?: ProviderChangeOrderItem[];
  loading: boolean;
  /** Pro: new customer change order. Crew: request a scope change (job-style). */
  onPropose?: () => void;
  proposeLabel?: string;
  proposeDisabled: boolean;
}) {
  const changeOrders = rows ?? (Array.isArray(order.changeOrders) ? order.changeOrders : []);
  const inField = order.status === "IN_PROGRESS" || order.status === "ARRIVED";
  const canPropose = inField && Boolean(onPropose);

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
                {co.status === "REQUESTED" || co.declinedByOffice
                  ? "—"
                  : `+$${Number(co.additionalAmount || 0).toFixed(2)}`}
              </span>
            </div>
            {co.officeNote ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Office:</span> {co.officeNote}
              </p>
            ) : null}
            {co.reason ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span>{" "}
                {co.reason}
              </p>
            ) : null}
            <div className="flex items-center gap-3 pt-1 text-xs">
              <StatusPill
                label={
                  co.status === "REQUESTED"
                    ? "Awaiting office"
                    : co.declinedByOffice
                      ? "Declined by office"
                      : formatOrderStatus(co.status || "PENDING")
                }
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
                  {co.requestedBy && co.requestedBy.type !== "provider" && co.requestedBy.name
                    ? ` by ${co.requestedBy.name}`
                    : ""}
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
          ? "Change orders and scope requests for this order appear here."
          : !onPropose && order.status !== "SETTLED" && order.status !== "CANCELLED"
            ? "Customer change orders appear here. Crew scope requests are on the Requests tab."
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
          {proposeLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** A crew scope request in the job "Accept updated scope" card's shape. */
function toFieldOrder(co: ProviderChangeOrderItem, index: number): ContractorJobChangeOrder {
  return {
    id: co.id || `scope-${index}`,
    number: "",
    title: co.title || "",
    description: co.description,
    status: co.status === "ACCEPTED" ? "approved" : "",
    requestedByMe: true,
    acceptance: co.status === "ACCEPTED" ? "accepted" : co.acceptance || "pending",
    acceptedAt: co.acceptedAt || null,
    items: (co.items || []).map((item, lineIndex) => ({
      id: item.id || `${co.id}-${lineIndex}`,
      description: item.description,
      kind: item.kind,
      quantity: item.quantity,
    })),
  };
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

/** Pro's page: the Pro assigns & manages; the assigned employee / contractor runs the field steps. */
function getProStageBanner(status: string, hasCrew: boolean) {
  const assign = hasCrew
    ? ""
    : " Assign an employee or contractor so they can run it from their portal.";
  switch (status) {
    case "CONFIRMED":
      return {
        tone: "border-blue-200 bg-blue-50/80 text-blue-950",
        message: hasCrew
          ? "Order is confirmed. The assigned crew departs, checks in on site and runs the work from their portal — status updates here live."
          : `Order is confirmed.${assign}`,
      };
    case "IN_TRANSIT":
      return {
        tone: "border-amber-200 bg-amber-50/80 text-amber-950",
        message: "The assigned crew is en route to the property. Arrival is verified against the 200m geofence.",
      };
    case "ARRIVED":
      return {
        tone: "border-purple-200 bg-purple-50/80 text-purple-950",
        message: "The assigned crew is on site (arrival verified) and about to start work.",
      };
    case "IN_PROGRESS":
      return {
        tone: "border-purple-200 bg-purple-50/80 text-purple-950",
        message:
          "Work is in progress by the assigned crew. Change orders and completion proof they submit appear in the tabs below.",
      };
    default:
      return getOrderStageBanner(status);
  }
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
          "Arrival on site verified. Check in to start the work — your time is tracked until you check out.",
      };
    case "IN_PROGRESS":
      return {
        tone: "border-purple-200 bg-purple-50/80 text-purple-950",
        message:
          "Work is in progress. Check out to pause (e.g. a break) and check in again to resume. Propose a change order for extra scope or parts, and Complete Work with photos when finished.",
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

/**
 * `viewer`: "provider" = the Pro's order page (/pro/dashboard/orders/[id]); "technician" /
 * "contractor" = the same screen in the crew portals for an assigned employee / contractor — the
 * thunks call that portal's order API, and Pro-only parts (accept / decline / cancel, payout,
 * financials, crew editing) are hidden.
 */
export function OrderDetailPageView({ id, viewer = "provider" }: { id: string; viewer?: OrderApiScope }) {
  // Before any fetch below: point the order thunks at this portal's API.
  if (getOrderApiScope() !== viewer) setOrderApiScope(viewer);
  const isPro = viewer === "provider";
  const listHref =
    viewer === "technician" ? "/technical/orders" : viewer === "contractor" ? "/contractor/orders" : "/pro/dashboard/orders";
  // Crew: fixed-price orders are listed under Jobs, so "back" goes to the Jobs list.
  const backHref =
    viewer === "technician" ? "/technical/jobs" : viewer === "contractor" ? "/contractor/jobs" : listHref;
  const backLabel = isPro ? "Back to fixed service orders" : "Back to my jobs";
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
  /** Crew "Request scope change" — the same dialog as a job (reason + description, no price). */
  const [scopeOpen, setScopeOpen] = useState(false);
  const crewPortal = viewer === "contractor" ? "contractor" : "technician";
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

  // Live status sync: the Pro, assigned crew and the customer all move the same order
  // (ORDER_UPDATED reaches every party's socket) — reload when it's this one.
  const refreshRef = useRef(refreshOrder);
  useEffect(() => {
    refreshRef.current = refreshOrder;
  });
  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      // Crew clocked in / out on this order → reload so the crew lock (Assign / Change / Remove) follows.
      if (type === "TIME_ENTRY_UPDATED") {
        const entry = ((detail.payload || {}) as { entry?: { order?: { id?: string } | null } }).entry;
        if (String(entry?.order?.id || "") === id) void refreshRef.current();
        return;
      }
      if (type !== "ORDER_UPDATED") return;
      const payload = (detail.payload || {}) as { id?: string; orderId?: string };
      if (String(payload.id || payload.orderId || "") === id) void refreshRef.current();
    });
  }, [id]);

  useEffect(() => {
    if (error && !loading) {
      toast.error(error);
      dispatch(clearProviderOrdersError());
    }
  }, [dispatch, error, loading]);

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
          <Link href={backHref}>{backLabel}</Link>
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

  // Change orders split like a job: crew ↔ office scope requests are internal (Pro: Requests tab;
  // crew: "Accept updated scope" cards); customer change orders are a separate Pro ↔ customer flow.
  const allChangeOrders = Array.isArray(order.changeOrders) ? order.changeOrders : [];
  const changeOrderRows = isPro
    ? allChangeOrders.filter((co) => co.audience !== "crew")
    : allChangeOrders.filter((co) => co.audience !== "crew" || (co.requestedByMe && !co.items?.length));
  const myScopeUpdates = isPro
    ? []
    : allChangeOrders.filter((co) => co.audience === "crew" && co.requestedByMe && Boolean(co.items?.length));
  const myPendingScope = myScopeUpdates.filter((co) => co.status === "SCOPE_ADDED");
  // Pro → customer change order: only while the work is on site / in progress (same rule as the API).
  const proCanSendChangeOrder = isPro && ["ARRIVED", "IN_PROGRESS"].includes(order.status);
  const acceptScope = async (field: ContractorJobChangeOrder) => {
    try {
      await crewAcceptOrderScope(crewPortal, order.id, field.id);
    } catch (err) {
      throw new Error(extractErrorMessage(err) || "Could not accept this scope update.");
    }
    await refreshOrder();
  };

  const tabs: RecordTab[] = [
    { id: "summary", label: "Summary" },
    { id: "service", label: "Service Scope" },
    { id: "customer", label: "Customer" },
    {
      id: "change_orders",
      label: `Change Orders (${changeOrderRows.length + myScopeUpdates.length})`,
    },
    { id: "completion", label: "Completion & Proof" },
    // Pro: crew completion requests, same tab + badge as a job's Requests.
    ...(isPro ? [{ id: "requests", label: "Requests", alert: orderPendingRequests(order) }] : []),
    ...(isPro ? [{ id: "financials", label: "Financials" }] : []),
  ];

  const hasCrew =
    (order.crew?.employees?.length || 0) + (order.crew?.contractors?.length || 0) > 0;
  // Crew can complete / raise change orders only while checked in on an in-progress order.
  // Crew: same as a job — once clocked in the order is in progress; Mark complete / Request scope change then open.
  const completionPending = order.crewCompletion?.status === "pending";
  const completionRejected = order.crewCompletion?.status === "rejected";
  const crewWorking = !isPro && order.status === "IN_PROGRESS" && !completionPending;
  const crewClosed = ["WORK_COMPLETED", "SETTLED", "CANCELLED"].includes(order.status);
  const banner = isPro
    ? completionPending
      ? {
          tone: "border-amber-200 bg-amber-50/80 text-amber-950",
          message: `${order.crewCompletion?.submittedBy?.name || "The crew"} marked the work complete. Review the proof on the Requests tab — approve to send it to the customer, or request re-work.`,
        }
      : order.status === "WORK_COMPLETED"
        ? {
            tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
            message: !order.invoice
              ? "Work approved. Convert the order to an invoice and send it to the customer — they pay it, then sign off."
              : order.invoice.status === "paid"
                ? `Invoice ${order.invoice.number} is paid. Waiting for the customer to sign off.`
                : order.invoice.status === "draft"
                  ? `Invoice ${order.invoice.number} is a draft. Open it and send it to the customer.`
                  : `Invoice ${order.invoice.number} was sent. The customer pays it, then signs off.`,
          }
        : getProStageBanner(order.status, hasCrew)
    : getOrderStageBanner(order.status);

  return (
    <>
      <RecordWorkspace
        href={`${listHref}/${order.id}`}
        label={`${orderLabel} · ${serviceTitle}`}
        backHref={backHref}
        backLabel={backLabel}
        kind="order"
        trackOpen={isPro}
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
                {crewWorking ? (
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => setScopeOpen(true)}
                    disabled={isActionLoading}
                  >
                    <FilePlus2 className="size-3.5" />
                    Request scope change
                  </Button>
                ) : proCanSendChangeOrder ? (
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => setActiveModal("changeOrder")}
                    disabled={isActionLoading}
                  >
                    <FilePlus2 className="size-3.5" />
                    New change order for customer
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
                {crewWorking ? (
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
        // Crew: job-style status (Scheduled / In progress / Completed / Paid), like their jobs.
        badge={isPro ? <OrderStatusPill status={order.displayStatus || order.status} full /> : <JobStatusPill status={orderStatusAsJob(order.status)} />}
        actions={
          <div className="ml-auto flex w-full flex-wrap items-center justify-start gap-2 max-sm:*:flex-auto sm:w-auto sm:justify-end">
            {/* Pro: assign crew (same buttons as a job). Crew: on-site check in / out. */}
            {isPro ? (
              <>
                <OrderInvoiceAction order={order} onChanged={refreshOrder} />
                <OrderCrewActions order={order} onChanged={refreshOrder} />
              </>
            ) : (
              // Same header as a job in the crew portals. Previous: Check in / Check out + Depart / Arrive / Start work.
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  disabled={!crewWorking || isActionLoading}
                  title={
                    crewWorking
                      ? "Send proof photos to the office to close this job"
                      : completionPending
                        ? "Waiting for the office to review your completion."
                        : "Clock in on site to start the work first."
                  }
                  onClick={() => setActiveModal("complete")}
                >
                  <CheckCircle2 className="size-3.5" /> {completionRejected ? "Resubmit work" : "Mark complete"}
                </Button>
                {viewer === "technician" ? (
                  <TechChatButton side="technician" contextType="general" label="Chat with office" className="h-8" />
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  disabled={!crewWorking || isActionLoading}
                  title={crewWorking ? undefined : crewClosed ? "This job is closed." : "Clock in on site to start the work first."}
                  onClick={() => setScopeOpen(true)}
                >
                  <FilePlus2 className="size-3.5" /> Request scope change
                </Button>
              </>
            )}

            {isPro && order.status === "BOOKING_REQUESTED" ? (
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

            {/* Field steps (Depart → Arrive → Start → Change order → Complete) are the assigned
                crew's — shown only in their portal. The Pro assigns, manages and can cancel. */}
            {order.status === "CONFIRMED" && (
              <>
                {isPro ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveModal("cancel")}
                    disabled={isActionLoading}
                    className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
                  >
                    <AlertCircle className="size-3.5" /> Cancel
                  </Button>
                ) : null}
              </>
            )}

            {order.status === "IN_TRANSIT" && (
              <>
                {isPro ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveModal("cancel")}
                    disabled={isActionLoading}
                    className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
                  >
                    <AlertCircle className="size-3.5" /> Cancel
                  </Button>
                ) : null}
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
                    {isPro ? (
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
                    ) : null}
                  </div>

                  {/* Crew sees where their completion stands. The Pro reviews it on the Requests tab
                      (like a job). Previous: an inline review card here on the Pro's Summary. */}
                  {!isPro ? <CrewCompletionBanner order={order} /> : null}
                  {isPro ? (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm",
                      banner.tone,
                    )}
                  >
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>{banner.message}</span>
                  </div>
                  ) : (
                    // Crew: "Time on this job" card, same as a job (Clock In starts the work).
                    <CrewOrderClockCard order={order} portal={viewer} onChanged={refreshOrder} />
                  )}
                  {myPendingScope.length ? (
                    <FieldExtraWork orders={myPendingScope.map(toFieldOrder)} onAccept={acceptScope} />
                  ) : null}

                  {/* Assigned employees / contractors (Pro: edit; crew: who else is on it). */}
                  <OrderCrewCard order={order} onChanged={refreshOrder} viewer={viewer} />

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
                      title={isPro ? "Service & payout" : "Service"}
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
                        {isPro ? (
                          <>
                            <Fact
                              label="Total Payout"
                              value={`${payoutTotal} ${payoutCurrency}`}
                            />
                            <Fact
                              label="Payment Status"
                              value={formatPaymentStatus(order.payment?.status)}
                            />
                          </>
                        ) : null}
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
                          <p className="text-xs text-muted-foreground">Address</p>
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
                      {isPro ? (
                        <Fact
                          label="Base Price"
                          value={`${order.service?.basePrice?.toFixed(2) || order.pricing?.basePrice?.toFixed(2) || "0.00"}`}
                        />
                      ) : null}
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
                      title="Property Address"
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
                          label="City, State, ZIP Code"
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
              const showLoading =
                detailLoadState !== "ready" &&
                detailLoadState !== "error" &&
                allChangeOrders.length === 0;
              // Pro: change orders sent to the customer as a table → row opens its detail page.
              // Previous: one card per change order.
              if (isPro) {
                return showLoading ? (
                  <ChangeOrdersTabPanel order={order} rows={[]} loading proposeDisabled />
                ) : (
                  <OrderChangeOrdersTable order={order} basePath={listHref} />
                );
              }
              return (
                <div className="flex flex-col gap-4">
                  {myScopeUpdates.length ? (
                    <FieldExtraWork orders={myScopeUpdates.map(toFieldOrder)} onAccept={acceptScope} />
                  ) : null}
                  <ChangeOrdersTabPanel
                    order={order}
                    rows={changeOrderRows}
                    loading={showLoading}
                    onPropose={
                      isPro
                        ? proCanSendChangeOrder
                          ? () => setActiveModal("changeOrder")
                          : undefined
                        : crewWorking
                          ? () => setScopeOpen(true)
                          : undefined
                    }
                    proposeLabel={isPro ? "New change order for customer" : "Request scope change"}
                    proposeDisabled={isActionLoading}
                  />
                </div>
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
                      {isPro ? (
                      <Fact
                        label="Tip Added"
                        value={
                          order.completionDetails?.customerSignOff?.tip
                            ? `$${order.completionDetails.customerSignOff.tip.toFixed(2)}`
                            : "$0.00"
                        }
                      />
                      ) : null}
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

            case "requests":
              return <OrderRequestsTab order={order} onDecided={refreshOrder} />;
            case "financials":
              if (!isPro) return null;
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
                            ? `(${formatTaxRatePercent(order.pricing.taxRate)}%)`
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

      {!isPro ? (
        <ChangeOrderRequestDialog
          job={{ id: order.id, number: order.orderNumber || "", title: serviceTitle }}
          open={scopeOpen}
          onOpenChange={setScopeOpen}
          submit={async (input) => {
            try {
              await crewOrderScopeRequest(viewer === "contractor" ? "contractor" : "technician", order.id, input);
            } catch (err) {
              throw new Error(extractErrorMessage(err) || "Could not send your request.");
            }
            await refreshOrder();
          }}
        />
      ) : null}
      <ChangeOrderModal
        order={order}
        isOpen={activeModal === "changeOrder"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleChangeOrder}
        loading={isActionLoading}
      />

      {!isPro ? (
        // Crew: the same "Mark as complete" dialog as a job (proof photos + notes for the office).
        // Previous: the Pro-style "Submit Work Completion" modal (notes required, before/after photos).
        <CompleteJobDialog
          job={{
            id: order.id,
            number: order.orderNumber || "",
            title: serviceTitle,
            completion: order.crewCompletion
              ? { status: order.crewCompletion.status, reviewNote: order.crewCompletion.reviewNote || "" }
              : null,
          }}
          open={activeModal === "complete"}
          onOpenChange={(next) => !next && setActiveModal(null)}
          submit={async (input) => {
            try {
              await crewCompleteOrder(crewPortal, order.id, input);
            } catch (err) {
              throw new Error(extractErrorMessage(err) || "Could not submit your completion.");
            }
            await refreshOrder();
          }}
        />
      ) : null}
      <CompleteWorkModal
        order={order}
        isOpen={isPro && activeModal === "complete"}
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
