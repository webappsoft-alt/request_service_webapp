"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileEdit,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Play,
  ShieldCheck,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { ProviderOrder } from "@/lib/types/provider-order";
import {
  formatOrderStatus,
  formatPaymentStatus,
  getOrderStatusConfig,
  getOrderStatusTone,
  OrderStatusPill,
} from "./order-status-pill";

export {
  formatOrderStatus,
  formatPaymentStatus,
  getOrderStatusConfig,
  getOrderStatusTone,
  OrderStatusPill,
};

export function OrderDetailSheet({
  order,
  isOpen,
  onClose,
  loading = false,
  onAccept,
  onReject,
  onTransit,
  onArrive,
  onStartWork,
  onChangeOrder,
  onComplete,
  onCancel,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  onAccept: (order: ProviderOrder) => void;
  onReject: (order: ProviderOrder) => void;
  onTransit: (order: ProviderOrder) => void;
  onArrive: (order: ProviderOrder) => void;
  onStartWork: (order: ProviderOrder) => void;
  onChangeOrder: (order: ProviderOrder) => void;
  onComplete: (order: ProviderOrder) => void;
  onCancel: (order: ProviderOrder) => void;
}) {
  if (!order) return null;

  const coords = order.address?.location?.coordinates;
  const mapsUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.address?.street}, ${order.address?.city}, ${order.address?.state} ${order.address?.zip}`,
      )}`;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full overflow-hidden bg-background"
      >
        {/* Header */}
        <div className="border-b border-border/80 px-6 py-4 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-lg text-foreground">
                {order.orderNumber || "Order Details"}
              </span>
              <StatusPill
                label={formatOrderStatus(order.status)}
                tone={getOrderStatusTone(order.status)}
              />
            </div>
            <Link
              href={`/pro/dashboard/orders/${order.id}`}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <span>Full Page</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="size-3.5" />
            <span>Created {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </SheetDescription>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : (
            <>
              {/* Primary Action Banner based on status */}
              <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Execution Phase
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {formatOrderStatus(order.status)}
                  </span>
                </div>

                <div className="pt-1 flex flex-wrap gap-2">
                  {order.status === "BOOKING_REQUESTED" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onAccept(order)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                      >
                        <CheckCircle2 className="size-3.5" /> Accept Booking
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onReject(order)}
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
                        onClick={() => onTransit(order)}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs font-medium"
                      >
                        <Navigation className="size-3.5" /> Depart (Start Transit)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancel(order)}
                        className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 text-xs"
                      >
                        <AlertCircle className="size-3.5" /> Emergency Cancel
                      </Button>
                    </>
                  )}

                  {order.status === "IN_TRANSIT" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onArrive(order)}
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs font-medium"
                      >
                        <MapPin className="size-3.5" /> Arrive On-Site (Verify Geofence)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancel(order)}
                        className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 text-xs"
                      >
                        <AlertCircle className="size-3.5" /> Emergency Cancel
                      </Button>
                    </>
                  )}

                  {order.status === "ARRIVED" && (
                    <Button
                      size="sm"
                      onClick={() => onStartWork(order)}
                      className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-8 text-xs font-medium"
                    >
                      <Play className="size-3.5" /> Start Physical Work
                    </Button>
                  )}

                  {order.status === "IN_PROGRESS" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onComplete(order)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                      >
                        <CheckCircle2 className="size-3.5" /> Submit Work Completion
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onChangeOrder(order)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <FileEdit className="size-3.5" /> + Propose Change Order
                      </Button>
                    </>
                  )}

                  {order.status === "CHANGE_ORDER_PENDING" && (
                    <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 w-full">
                      <Clock className="size-4 shrink-0 text-amber-600" />
                      <span>Change order proposed. Awaiting customer acceptance before continuing.</span>
                    </div>
                  )}

                  {order.status === "WORK_COMPLETED" && (
                    <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2 w-full">
                      <FileCheck2 className="size-4 shrink-0 text-emerald-600" />
                      <span>Work complete and photographic evidence submitted. Awaiting customer sign-off & settlement.</span>
                    </div>
                  )}

                  {order.status === "CANCELLED" && (
                    <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2 w-full">
                      <XCircle className="size-4 shrink-0 text-red-600" />
                      <span>Order was cancelled. Slot has been released.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scheduled Appointment Slot */}
              {order.booking?.startTime ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                    <Clock className="size-3.5 text-blue-600" /> Scheduled Appointment Slot
                  </div>
                  <p className="text-blue-950 font-medium text-xs">
                    {new Date(order.booking.startTime).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(order.booking.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {order.booking.endTime
                      ? ` – ${new Date(order.booking.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                    {order.booking.durationMinutes
                      ? ` (${order.booking.durationMinutes} mins)`
                      : ""}
                  </p>
                </div>
              ) : null}

              {/* Service & Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Service Card */}
                <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Wrench className="size-3.5" /> Service Details
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    {order.service?.title || "Standard Operational Service"}
                  </p>
                  {order.service?.category ? (
                    <p className="text-xs text-muted-foreground">
                      Category: {order.service.category} {order.service.subcategory ? `· ${order.service.subcategory}` : ""}
                    </p>
                  ) : null}
                  <div className="text-xs font-medium text-foreground pt-1">
                    Base Price: ${order.pricing?.basePrice?.toFixed(2) || "0.00"}
                  </div>
                </div>

                {/* Customer Card */}
                <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <User className="size-3.5" /> Customer Contact
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    {order.customer?.name || "Customer Property Owner"}
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {order.customer?.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="size-3" />
                        <a href={`tel:${order.customer.phone}`} className="hover:underline text-foreground">
                          {order.customer.phone}
                        </a>
                      </div>
                    ) : null}
                    {order.customer?.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3" />
                        <a href={`mailto:${order.customer.email}`} className="hover:underline text-foreground">
                          {order.customer.email}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Property Address & Geofence Details */}
              <div className="rounded-lg border border-border p-3.5 space-y-2.5 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <MapPin className="size-3.5 text-red-500" /> Service Location & Geofence
                  </div>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>Google Maps Directions</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="text-sm font-medium text-foreground">
                  {order.address?.street}
                  {order.address?.unit ? ` (Unit ${order.address.unit})` : ""}
                  , {order.address?.city}, {order.address?.state} {order.address?.zip}
                </div>

                {coords ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/40 px-2.5 py-1.5 rounded border border-border/60">
                    <span>GPS: [{coords[0].toFixed(5)}, {coords[1].toFixed(5)}]</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-auto">200m Geofence Active</span>
                  </div>
                ) : null}

                {order.address?.notes ? (
                  <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded">
                    <span className="font-semibold text-foreground">Customer Notes: </span>
                    {order.address.notes}
                  </div>
                ) : null}
              </div>

              {/* Pricing Breakdown */}
              <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="size-3.5" /> Financial & Payment Ledger
                  </div>
                  <div className="flex items-center gap-1 text-foreground font-normal">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span>Payment {order.payment?.status || "AUTHORIZED"}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Service Scope</span>
                    <span className="text-foreground">${order.pricing?.basePrice?.toFixed(2) || "0.00"}</span>
                  </div>
                  {order.pricing?.changeOrdersTotal ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Change Orders</span>
                      <span className="text-foreground">+${order.pricing.changeOrdersTotal.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground">${order.pricing?.subtotal?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sales Tax ({(Number(order.pricing?.taxRate || 0) * 100).toFixed(2)}%)</span>
                    <span className="text-foreground">${order.pricing?.taxAmount?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                    <span>Total Authorization</span>
                    <span className="text-emerald-700">${order.pricing?.totalAmount?.toFixed(2) || "0.00"} {order.pricing?.currency || "USD"}</span>
                  </div>
                </div>
              </div>

              {/* Change Orders Ledger */}
              {order.changeOrders && order.changeOrders.length > 0 ? (
                <div className="rounded-lg border border-border p-3.5 space-y-2.5 bg-card">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Change Orders Ledger ({order.changeOrders.length})</span>
                  </div>

                  <div className="space-y-2">
                    {order.changeOrders.map((co, idx) => (
                      <div key={co.id || idx} className="rounded border border-border/80 p-2.5 text-xs space-y-1 bg-muted/20">
                        <div className="flex justify-between font-medium">
                          <span className="text-foreground">{co.description}</span>
                          <span className="font-semibold text-emerald-700">+${co.additionalAmount?.toFixed(2)}</span>
                        </div>
                        {co.reason ? (
                          <p className="text-muted-foreground italic text-[11px]">{co.reason}</p>
                        ) : null}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                          <span className="capitalize px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                            {co.status || "PENDING"}
                          </span>
                          {co.createdAt ? <span>{new Date(co.createdAt).toLocaleDateString()}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Completion Details */}
              {order.completionDetails ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900 uppercase tracking-wider">
                    <CheckCircle2 className="size-3.5 text-emerald-600" /> Work Completion Record
                  </div>
                  {order.completionDetails.completionNotes ? (
                    <p className="text-emerald-950 leading-relaxed">
                      {order.completionDetails.completionNotes}
                    </p>
                  ) : null}

                  {order.completionDetails.afterPhotos && order.completionDetails.afterPhotos.length > 0 ? (
                    <div className="pt-2">
                      <span className="font-medium text-emerald-900 text-[11px]">Proof of Work Photos:</span>
                      <div className="grid grid-cols-4 gap-2 pt-1.5">
                        {order.completionDetails.afterPhotos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded overflow-hidden border border-emerald-300 block hover:opacity-90 transition-opacity">
                            <img src={url} alt={`proof-${i}`} className="size-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Cancellation Reason if cancelled */}
              {order.cancellationReason || order.rejectionReason ? (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 space-y-1 text-xs text-red-900">
                  <div className="flex items-center gap-1.5 font-semibold text-red-800 uppercase tracking-wider">
                    <AlertCircle className="size-3.5 text-red-600" /> Reason for Cancellation
                  </div>
                  <p className="text-red-950 leading-relaxed">
                    {order.cancellationReason || order.rejectionReason}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
