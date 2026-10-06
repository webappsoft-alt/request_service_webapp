"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Briefcase, Eye, Receipt } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";
import { orderServiceTitle } from "@/lib/orders/order-display";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomerChangeOrders,
  isPendingChangeOrderStatus,
  selectCustomerChangeOrders,
  selectCustomerChangeOrdersLoaded,
} from "@/store/customerChangeOrdersSlice";
import {
  CUSTOMER_ORDERS_PAGE_LIMIT,
  fetchCustomerOrders,
  selectCustomerOrders,
} from "@/store/ordersSlice";

function statusLabel(status: string) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
    case "pending_approval":
      return "Awaiting approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "—";
  }
}

function statusTone(status: string) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
    case "pending_approval":
      return "warning" as const;
    case "approved":
      return "success" as const;
    case "rejected":
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function lineTotals(items: Array<{ kind?: string; total?: number }> = []) {
  let labour = 0;
  let material = 0;
  for (const line of items) {
    const kind = String(line.kind || "labor").toLowerCase();
    if (kind === "material" || kind === "materials") material += Number(line.total) || 0;
    else if (kind === "labor" || kind === "labour" || kind === "service") {
      labour += Number(line.total) || 0;
    }
  }
  return { labour, material };
}

export function CustomerChangeOrdersView() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCustomerChangeOrders);
  const loaded = useAppSelector(selectCustomerChangeOrdersLoaded);
  const orders = useAppSelector(selectCustomerOrders);

  // Always refresh on open; cached rows stay on screen while it loads.
  useEffect(() => {
    void dispatch(fetchCustomerChangeOrders());
  }, [dispatch]);

  // Job title + provider come from Orders; load them once if not cached yet.
  const ordersLoaded = useAppSelector((state) => Boolean(state.orders?.listLoaded));
  useEffect(() => {
    if (ordersLoaded) return;
    void dispatch(fetchCustomerOrders({ page: 1, limit: CUSTOMER_ORDERS_PAGE_LIMIT }));
  }, [dispatch, ordersLoaded]);

  const pendingCount = useMemo(
    () => items.filter((item) => isPendingChangeOrderStatus(item.status)).length,
    [items],
  );

  /** Job title + provider from the cached Orders list (job id = order id). */
  const jobInfo = useMemo(() => {
    const map = new Map<string, { title: string; provider: string }>();
    for (const order of orders) {
      map.set(String(order.id), {
        title: orderServiceTitle(order),
        provider: order.provider?.companyName || "",
      });
    }
    return map;
  }, [orders]);

  if (!loaded && !items.length) {
    return (
      <PortalPage
        eyebrow="Activity"
        title="Change orders"
        description="Additional work requests from your service provider."
      >
        <CenteredSpinner label="Loading change orders…" className="min-h-64" />
      </PortalPage>
    );
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Change orders"
      description="Additional work requests from your service provider. Each one is priced, approved, and paid separately from the original job."
    >
      {pendingCount > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          Action required — {pendingCount} change{" "}
          {pendingCount === 1 ? "order" : "orders"} awaiting your approval
        </div>
      ) : null}
      <PortalDataTable
        filename="customer-change-orders"
        countLabel="Change orders"
        searchPlaceholder="Search change orders…"
        rows={items}
        rowKey={(row) => `${row.jobId}-${row.id}`}
        rowHref={(row) => customerPaths.changeOrder(row.jobId, row.id)}
        rowClassName={(row) =>
          isPendingChangeOrderStatus(row.status) ? "bg-amber-50/70 hover:bg-amber-50" : undefined
        }
        empty="No change orders yet."
        columns={[
          {
            id: "number",
            header: "Change order",
            sortValue: (row) => row.number,
            searchValue: (row) => `${row.number} ${row.title} ${row.description}`,
            exportValue: (row) => `${row.number} ${row.title}`,
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={customerPaths.changeOrder(row.jobId, row.id)}
                  className="font-medium text-primary hover:underline"
                >
                  {row.number}
                </Link>
                <p className="max-w-[16rem] truncate text-xs text-muted-foreground">
                  {row.title || row.description || "Additional work"}
                </p>
              </div>
            ),
          },
          {
            id: "job",
            header: "Job",
            sortValue: (row) => row.jobNumber || "",
            searchValue: (row) =>
              `${row.jobNumber} ${jobInfo.get(String(row.jobId))?.title || ""} ${row.propertyAddress || ""}`,
            exportValue: (row) => row.jobNumber || "",
            cell: (row) => {
              const info = jobInfo.get(String(row.jobId));
              return (
                <div className="min-w-0">
                  <Link
                    href={customerPaths.order(row.jobId)}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.jobNumber || "View job"}
                  </Link>
                  <p className="max-w-[16rem] truncate text-xs text-muted-foreground">
                    {[info?.title, row.propertyAddress].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              );
            },
          },
          {
            id: "provider",
            header: "Professional",
            sortValue: (row) => jobInfo.get(String(row.jobId))?.provider || "",
            exportValue: (row) => jobInfo.get(String(row.jobId))?.provider || "",
            cell: (row) => (
              <span className="text-foreground">
                {jobInfo.get(String(row.jobId))?.provider || "—"}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => (isPendingChangeOrderStatus(row.status) ? 0 : 1),
            exportValue: (row) => statusLabel(row.status),
            cell: (row) => (
              <StatusPill label={statusLabel(row.status)} tone={statusTone(row.status)} />
            ),
          },
          {
            id: "sent",
            header: "Sent",
            sortValue: (row) => row.sentAt || row.requestedAt || "",
            exportValue: (row) => row.sentAt || "",
            cell: (row) => (
              <span className="text-muted-foreground">
                {row.sentAt || row.requestedAt
                  ? formatShortDate(String(row.sentAt || row.requestedAt))
                  : "—"}
              </span>
            ),
          },
          {
            id: "invoice",
            header: "Invoice",
            sortValue: (row) => row.billingInvoiceNumber || "",
            exportValue: (row) => row.billingInvoiceNumber || "",
            cell: (row) =>
              row.billingInvoiceId ? (
                <Link
                  href={customerPaths.invoice(row.billingInvoiceId)}
                  className="font-medium text-primary hover:underline"
                >
                  {row.billingInvoiceNumber || "Invoice"}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            id: "breakdown",
            header: "Labour / Material",
            className: "text-right",
            sortValue: (row) => lineTotals(row.items).labour,
            exportValue: (row) => {
              const t = lineTotals(row.items);
              return `${t.labour} / ${t.material}`;
            },
            cell: (row) => {
              const t = lineTotals(row.items);
              return (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatMoney(t.labour)} / {formatMoney(t.material)}
                </span>
              );
            },
          },
          {
            id: "amount",
            header: "Amount",
            className: "text-right",
            sortValue: (row) => row.amount ?? 0,
            exportValue: (row) => String(row.amount ?? 0),
            cell: (row) => (
              <span className="font-semibold tabular-nums text-[#003F7D]">
                {formatMoney(row.amount)}
              </span>
            ),
          },
        ]}
        actions={(row) => [
          {
            label: isPendingChangeOrderStatus(row.status) ? "Review & approve" : "View details",
            href: customerPaths.changeOrder(row.jobId, row.id),
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
          {
            label: `Open job ${row.jobNumber || ""}`.trim(),
            href: customerPaths.order(row.jobId),
            icon: <Briefcase className="size-3.5" />,
          },
          ...(row.billingInvoiceId
            ? [
                {
                  label: `Invoice ${row.billingInvoiceNumber || ""}`.trim(),
                  href: customerPaths.invoice(row.billingInvoiceId),
                  icon: <Receipt className="size-3.5" />,
                },
              ]
            : []),
        ]}
      />
    </PortalPage>
  );
}
