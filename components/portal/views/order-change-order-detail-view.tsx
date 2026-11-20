"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  ChangeOrderStatusPill,
  changeOrderNumber,
  changeOrderTitle,
} from "@/components/portal/orders/order-change-orders-table";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProviderOrderById, getOrderApiScope, setOrderApiScope } from "@/store/providerOrdersSlice";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Pro: one change order sent to the customer on a fixed service order (from the order's Change
 * Orders table). Read-only — the customer approves / declines it from their portal.
 */
export function OrderChangeOrderDetailView({ orderId, changeOrderId }: { orderId: string; changeOrderId: string }) {
  if (getOrderApiScope() !== "provider") setOrderApiScope("provider");
  const dispatch = useAppDispatch();
  const order = useAppSelector((state) => {
    const slice = state.providerOrders;
    if (slice?.selectedOrder?.id === orderId) return slice.selectedOrder;
    return slice?.detailsCache?.[orderId] ?? null;
  });
  const loading = useAppSelector((state) => Boolean(state.providerOrders?.selectedLoading));

  useEffect(() => {
    void dispatch(fetchProviderOrderById(orderId));
  }, [dispatch, orderId]);

  const backHref = `/pro/dashboard/orders/${orderId}?tab=change_orders`;
  const co = order?.changeOrders?.find((row) => row.id === changeOrderId && row.audience !== "crew") || null;

  if (!order || !co) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border-soft bg-card p-8 text-center">
        {loading || !order ? (
          <>
            <Spinner className="size-6 text-primary" />
            <p className="text-sm text-muted-foreground">Loading change order…</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">This change order wasn&apos;t found on the order.</p>
            <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
              Back to change orders
            </Link>
          </>
        )}
      </div>
    );
  }

  const number = changeOrderNumber(order, co);
  const crewRequest = co.fromRequestId ? order.changeOrders?.find((row) => row.id === co.fromRequestId) : null;
  const customerName =
    order.customer?.name || `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || "Customer";
  const status = String(co.status || "PENDING").toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border-soft bg-card px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href={backHref}
            aria-label="Back to change orders"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Change order · {order.orderNumber}
            </p>
            <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              {number} · {changeOrderTitle(co)}
              <ChangeOrderStatusPill status={co.status} />
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Amount</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">+{formatMoney(co.additionalAmount)}</p>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-border-soft bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Order">
          <Link href={`/pro/dashboard/orders/${order.id}`} className="font-medium text-primary hover:underline">
            {order.orderNumber}
          </Link>
          {order.service?.title ? <p className="truncate text-xs text-muted-foreground">{order.service.title}</p> : null}
        </Fact>
        <Fact label="Customer">
          {customerName}
          {order.customer?.phone ? <p className="text-xs text-muted-foreground">{order.customer.phone}</p> : null}
        </Fact>
        <Fact label="Sent">{co.createdAt ? formatDate(co.createdAt) : "—"}</Fact>
        <Fact label="Customer response">
          {status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Declined" : "Waiting"}
          {co.respondedAt ? <p className="text-xs text-muted-foreground">{formatDate(co.respondedAt)}</p> : null}
        </Fact>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-soft bg-card">
        <div className="border-b border-border-soft px-5 py-3">
          <p className="text-sm font-semibold">Line items</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Description</th>
              <th className="px-5 py-2 text-right font-semibold">Qty</th>
              <th className="px-5 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border-soft">
              <td className="px-5 py-3 whitespace-pre-wrap">{co.description}</td>
              <td className="px-5 py-3 text-right tabular-nums">1</td>
              <td className="px-5 py-3 text-right font-medium tabular-nums">{formatMoney(co.additionalAmount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-border-soft bg-muted/20">
              <td className="px-5 py-3 font-semibold" colSpan={2}>
                Total
              </td>
              <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(co.additionalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {co.reason || co.customerNote || crewRequest ? (
        <div className="grid gap-4 rounded-lg border border-border-soft bg-card p-5 sm:grid-cols-2">
          {co.reason ? <Fact label="Reason">{co.reason}</Fact> : null}
          {co.customerNote ? (
            <Fact label="Customer note">
              <p className="whitespace-pre-wrap">{co.customerNote}</p>
            </Fact>
          ) : null}
          {crewRequest ? (
            <Fact label="From crew request">
              {crewRequest.requestedBy?.name || "Crew"}: {crewRequest.description}
              {crewRequest.reason ? <p className="text-xs text-muted-foreground">{crewRequest.reason}</p> : null}
            </Fact>
          ) : null}
        </div>
      ) : null}

      {co.evidencePhotos?.length ? (
        <div className="rounded-lg border border-border-soft bg-card p-5">
          <p className="text-sm font-semibold">Photos</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {co.evidencePhotos.map((photo, index) => (
              <a
                key={`${photo}-${index}`}
                href={photo}
                target="_blank"
                rel="noreferrer"
                className="relative block size-28 overflow-hidden rounded-md border border-border-soft bg-muted hover:opacity-85"
              >
                <Image src={photo} alt={`Photo ${index + 1}`} fill className="object-cover" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
