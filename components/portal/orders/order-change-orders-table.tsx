"use client";

import { Eye } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate, formatMoney } from "@/lib/format";
import type { ProviderChangeOrderItem, ProviderOrder } from "@/lib/types/provider-order";

/**
 * Pro → customer change orders on a fixed service order, as a table (click a row → its detail page).
 * Numbered CO-01, CO-02… in the order they were sent — the same numbers the customer sees.
 * Crew ↔ office scope requests are not here (they're on the Requests tab).
 */

/** Customer change orders on the order, oldest first (CO-01 = the first one sent). */
export function customerChangeOrders(order: ProviderOrder) {
  return (order.changeOrders || []).filter((co) => co.audience !== "crew");
}

export function changeOrderNumber(order: ProviderOrder, co: ProviderChangeOrderItem) {
  const index = customerChangeOrders(order).findIndex((row) => row.id === co.id);
  return `CO-${String((index < 0 ? 0 : index) + 1).padStart(2, "0")}`;
}

export function changeOrderTitle(co: ProviderChangeOrderItem) {
  const first = String(co.description || "").split(/\r?\n/)[0].trim();
  return first.length > 80 ? `${first.slice(0, 77)}…` : first || "Change order";
}

/** Customer-facing status of a change order. */
export function ChangeOrderStatusPill({ status }: { status?: string }) {
  const value = String(status || "PENDING").toUpperCase();
  if (value === "APPROVED") return <StatusPill tone="success" label="Approved" />;
  if (value === "REJECTED") return <StatusPill tone="danger" label="Declined" />;
  return <StatusPill tone="warning" label="Awaiting approval" />;
}

type Row = { co: ProviderChangeOrderItem; number: string };

export function OrderChangeOrdersTable({ order, basePath }: { order: ProviderOrder; basePath: string }) {
  const rows: Row[] = customerChangeOrders(order).map((co, index) => ({
    co,
    number: `CO-${String(index + 1).padStart(2, "0")}`,
  }));
  const href = (row: Row) => `${basePath}/${order.id}/change-orders/${row.co.id}`;

  return (
    <PortalDataTable
      filename={`${order.orderNumber || "order"}-change-orders`}
      countLabel="Change orders"
      searchPlaceholder="Search change orders…"
      empty="No change orders sent to the customer yet."
      rows={rows}
      rowKey={(row) => row.co.id || row.number}
      rowHref={href}
      rowClassName={(row) => (String(row.co.status || "").toUpperCase() === "PENDING" ? "bg-amber-50/40" : undefined)}
      columns={[
        {
          id: "number",
          header: "Change order",
          className: "min-w-56",
          sortValue: (row) => row.number,
          searchValue: (row) => `${row.number} ${row.co.description} ${row.co.reason || ""}`,
          exportValue: (row) => `${row.number} ${changeOrderTitle(row.co)}`,
          cell: (row) => (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{row.number}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{changeOrderTitle(row.co)}</p>
            </div>
          ),
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row) => String(row.co.status || ""),
          exportValue: (row) => String(row.co.status || ""),
          cell: (row) => <ChangeOrderStatusPill status={row.co.status} />,
        },
        {
          id: "source",
          header: "Source",
          exportValue: (row) => (row.co.fromRequestId ? "Crew request" : "Office"),
          cell: (row) => (
            <span className="text-sm text-muted-foreground">{row.co.fromRequestId ? "From crew request" : "Office"}</span>
          ),
        },
        {
          id: "sent",
          header: "Sent",
          sortValue: (row) => String(row.co.createdAt || ""),
          exportValue: (row) => (row.co.createdAt ? formatDate(row.co.createdAt) : ""),
          cell: (row) => <span className="whitespace-nowrap text-sm">{row.co.createdAt ? formatDate(row.co.createdAt) : "—"}</span>,
        },
        {
          id: "responded",
          header: "Customer response",
          sortValue: (row) => String(row.co.respondedAt || ""),
          exportValue: (row) => (row.co.respondedAt ? formatDate(row.co.respondedAt) : ""),
          cell: (row) => (
            <span className="whitespace-nowrap text-sm">{row.co.respondedAt ? formatDate(row.co.respondedAt) : "—"}</span>
          ),
        },
        {
          id: "amount",
          header: "Amount",
          className: "text-right",
          sortValue: (row) => row.co.additionalAmount,
          exportValue: (row) => String(row.co.additionalAmount),
          cell: (row) => (
            <span className="block text-right text-sm font-semibold tabular-nums">+{formatMoney(row.co.additionalAmount)}</span>
          ),
        },
      ]}
      actions={(row) => [{ label: "View", icon: <Eye />, href: href(row) }]}
    />
  );
}
