"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { JobStatusPill } from "@/components/technician/tech-ui";
import type { CrewOrderListRow, CrewPortal } from "@/lib/api/order-crew-client";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCrewOrders, selectCrewOrders } from "@/store/crewOrdersSlice";

/**
 * Crew portals (technician / contractor): fixed-price orders live inside "Jobs" — one list, no
 * separate page and no "fixed price" wording for the crew. Order rows open the order screen
 * (/technical|/contractor/orders/[id]). Previous: an All · Jobs · Fixed price type filter and a
 * "Fixed price" tag on order rows.
 */

/**
 * The crew sees a fixed-price order with the same statuses as a job (no "In transit" / "Arrived"
 * steps — they just clock in on site): Confirmed / In transit / Arrived → Scheduled,
 * In progress / Change order pending → In progress, Work completed → Completed, Settled → Paid.
 */
export function orderStatusAsJob(status: string): string {
  switch (status) {
    case "BOOKING_REQUESTED":
      return "unscheduled";
    case "CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED":
      return "scheduled";
    case "IN_PROGRESS":
    case "CHANGE_ORDER_PENDING":
      return "in_progress";
    case "WORK_COMPLETED":
      return "completed";
    case "SETTLED":
      return "paid";
    case "CANCELLED":
      return "cancelled";
    default:
      return status.toLowerCase();
  }
}

/** Order statuses that count as finished (the "Completed" scope). */
export const ORDER_DONE_STATUSES = ["WORK_COMPLETED", "SETTLED", "CANCELLED"];

/** One row of the merged list — a job or a fixed-price order. */
export type CrewWorkRow = {
  key: string;
  kind: "job" | "order";
  id: string;
  number: string;
  title: string;
  customer: string;
  phone: string;
  address: string;
  scheduledAt: string | null;
  /** Newest first (order: when you were assigned; job: when it was created). */
  at: number;
  status: ReactNode;
  statusText: string;
  done: boolean;
  href: string;
  /** Extra line under the number (e.g. "Clocked in"). */
  badge?: ReactNode;
  /** Rich address cell (e.g. directions button); falls back to the address text. */
  addressCell?: ReactNode;
  /** Chat button (Chat column shows when any row has one). */
  chat?: ReactNode;
};

export function orderWorkRow(order: CrewOrderListRow, href: string): CrewWorkRow {
  return {
    key: `order:${order.id}`,
    kind: "order",
    id: order.id,
    number: order.orderNumber || "Order",
    title: order.title,
    customer: order.customerName,
    phone: order.customerPhone,
    address: order.address,
    scheduledAt: order.scheduledAt,
    at: new Date(order.assignedAt || order.scheduledAt || 0).getTime() || 0,
    // Job-style status for the crew (was <OrderStatusPill>: "In Transit", "Arrived"…).
    status: <JobStatusPill status={orderStatusAsJob(order.status)} />,
    statusText: orderStatusAsJob(order.status),
    done: ORDER_DONE_STATUSES.includes(order.status),
    href,
  };
}

/**
 * Orders assigned to me, from the shared crewOrders slice (CrewOrdersSync in the shell keeps it
 * fresh on socket updates). Previous: fetched + subscribed here on its own (duplicate requests).
 */
export function useCrewOrderRows(portal: CrewPortal) {
  const dispatch = useAppDispatch();
  const { rows, error } = useAppSelector((state) => selectCrewOrders(state, portal));
  useEffect(() => {
    void dispatch(fetchCrewOrders({ portal }));
  }, [dispatch, portal]);
  return { orders: rows, loading: rows === null && !error, error };
}

/** Job status filter (contractor dropdown) applied to an order — by its job-style status. */
export function orderMatchesJobStatus(orderStatus: string, jobStatus: string) {
  if (!jobStatus) return true;
  return orderStatusAsJob(orderStatus) === jobStatus;
}

/**
 * Every page of a paginated jobs list (100 per request, up to 1,000), so the merged list isn't
 * capped at the first page.
 */
export async function loadAllPages<T>(
  load: (page: number) => Promise<{ items: T[]; totalPages: number }>,
  maxPages = 10,
): Promise<T[]> {
  const first = await load(1);
  const pages = Math.min(maxPages, Math.max(1, first.totalPages || 1));
  if (pages === 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => load(i + 2)));
  return [...first.items, ...rest.flatMap((res) => res.items)];
}

/** The merged jobs + fixed-price list (client-side search, sort and pages). */
export function CrewWorkTable({
  rows,
  loading,
  toolbar,
  filename,
  empty,
}: {
  rows: CrewWorkRow[];
  loading: boolean;
  toolbar: ReactNode;
  filename: string;
  empty: string;
}) {
  const sorted = [...rows].sort((a, b) => b.at - a.at);
  return (
    <PortalDataTable
      filename={filename}
      countLabel="Jobs"
      searchPlaceholder="Search job #, customer, address"
      loading={loading}
      empty={empty}
      rows={sorted}
      rowKey={(row) => row.key}
      rowHref={(row) => row.href}
      toolbar={toolbar}
      columns={[
        {
          id: "number",
          header: "Job #",
          sortValue: (row) => row.number,
          searchValue: (row) => `${row.number} ${row.title}`,
          exportValue: (row) => row.number,
          cell: (row) => (
            <div className="min-w-0">
              <Link href={row.href} className="font-semibold text-primary hover:underline">
                {row.number}
              </Link>
              {row.title ? <p className="truncate text-xs text-muted-foreground">{row.title}</p> : null}
              {row.badge}
            </div>
          ),
        },
        {
          id: "customer",
          header: "Customer",
          sortValue: (row) => row.customer,
          searchValue: (row) => `${row.customer} ${row.phone}`,
          exportValue: (row) => row.customer,
          cell: (row) => (
            <div>
              <p className="font-medium">{row.customer || "—"}</p>
              {row.phone ? (
                <a href={`tel:${row.phone}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {row.phone}
                </a>
              ) : null}
            </div>
          ),
        },
        {
          id: "address",
          header: "Address",
          className: "min-w-56",
          searchValue: (row) => row.address,
          exportValue: (row) => row.address,
          cell: (row) => row.addressCell ?? <span className="line-clamp-2">{row.address || "—"}</span>,
        },
        {
          id: "scheduled",
          header: "Scheduled",
          sortValue: (row) => row.scheduledAt || "",
          exportValue: (row) => (row.scheduledAt ? formatDate(row.scheduledAt) : ""),
          cell: (row) => (row.scheduledAt ? formatDate(row.scheduledAt) : "—"),
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row) => row.statusText,
          searchValue: (row) => row.statusText,
          exportValue: (row) => row.statusText,
          cell: (row) => row.status,
        },
        ...(sorted.some((row) => row.chat)
          ? [
              {
                id: "chat",
                header: "Chat",
                className: "w-16",
                exportValue: () => "",
                cell: (row: CrewWorkRow) => row.chat ?? null,
              },
            ]
          : []),
      ]}
      actions={(row) => [{ label: "Open job", href: row.href }]}
    />
  );
}
