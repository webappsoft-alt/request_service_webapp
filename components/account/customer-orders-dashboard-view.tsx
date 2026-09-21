"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileText, Receipt, Sparkles } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import {
  formatOrderAddressLine,
  formatOrderDateTime,
  formatOrderMoney,
  orderServiceTitle,
} from "@/lib/orders/order-display";
import {
  formatOrderStatus,
} from "@/lib/orders/order-status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  CUSTOMER_ORDERS_PAGE_LIMIT,
  customerOrderDetailFromListItem,
  fetchCustomerOrders,
  selectCustomerOrders,
  selectCustomerOrdersLoading,
  selectCustomerOrdersPagination,
  setCustomerOrderDetail,
} from "@/store/ordersSlice";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "BOOKING_REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "WORK_COMPLETED", label: "Completed" },
  { value: "SETTLED", label: "Settled" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

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

export function CustomerOrdersDashboardView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const orders = useAppSelector(selectCustomerOrders);
  const loading = useAppSelector(selectCustomerOrdersLoading);
  const pagination = useAppSelector(selectCustomerOrdersPagination);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.orders)}`,
      );
      return;
    }
    void dispatch(
      fetchCustomerOrders({
        page,
        limit: CUSTOMER_ORDERS_PAGE_LIMIT,
        status: status === "all" ? undefined : status,
      }),
    );
  }, [auth.hydrated, dispatch, isAuthenticated, page, router, status]);

  if (!auth.hydrated || (!isAuthenticated && !loading)) {
    return <CenteredSpinner label="Checking your account…" />;
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Orders"
      description="Booked fixed services and job requests. Open a row to view status, schedule, and actions."
    >
      <PortalDataTable
        filename="customer-orders"
        countLabel="Orders"
        searchPlaceholder="Search orders…"
        loading={loading}
        serverPagination={{
          page: pagination.page || page,
          pageSize: pagination.limit || CUSTOMER_ORDERS_PAGE_LIMIT,
          total: pagination.total || orders.length,
          totalPages: pagination.totalPages || 1,
          onPageChange: (nextPage) => setPage(nextPage),
          search,
          onSearchChange: (val) => setSearch(val),
        }}
        toolbar={
          <div className="h-8.5 w-40 sm:w-44">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                id="orders-status-filter"
                aria-label="Filter by status"
                className="h-full w-full text-xs"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent align="end">
                {STATUS_FILTERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        rows={orders}
        rowKey={(row) => row.id}
        rowHref={(row) => customerPaths.order(row.id)}
        empty="No orders found."
        columns={[
          {
            id: "service",
            header: "Service",
            sortValue: (row) => orderServiceTitle(row),
            searchValue: (row) => `${orderServiceTitle(row)} ${row.orderNumber || ""}`,
            exportValue: (row) => orderServiceTitle(row),
            cell: (row) => (
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={customerPaths.order(row.id)}
                    onClick={() =>
                      dispatch(
                        setCustomerOrderDetail(customerOrderDetailFromListItem(row)),
                      )
                    }
                    className="font-medium text-primary hover:underline"
                  >
                    {orderServiceTitle(row)}
                  </Link>
                  {row.orderType === "pro_service" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      <Sparkles className="size-2.5" />
                      Pro Service
                    </span>
                  ) : null}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {row.orderNumber || row.id.slice(0, 8)}
                  {row.provider?.companyName ? ` · ${row.provider.companyName}` : ""}
                </p>
              </div>
            ),
          },
          {
            id: "schedule",
            header: "Schedule",
            sortValue: (row) => row.booking?.startTime ?? "",
            cell: (row) => (
              <span className="text-muted-foreground">
                {row.booking?.startTime
                  ? formatOrderDateTime(row.booking.startTime)
                  : "—"}
              </span>
            ),
          },
          {
            id: "location",
            header: "Location",
            sortValue: (row) => formatOrderAddressLine(row.address),
            cell: (row) => (
              <span className="line-clamp-2 max-w-[14rem] text-muted-foreground">
                {formatOrderAddressLine(row.address) || "—"}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            cell: (row) => (
              <StatusPill
                label={formatOrderStatus(row.status)}
                tone={orderTone(row.status)}
              />
            ),
          },
          {
            id: "total",
            header: "Total",
            sortValue: (row) => row.pricing.totalAmount ?? 0,
            cell: (row) => (
              <span className="font-bold tabular-nums text-[#003F7D]">
                {formatOrderMoney(row.pricing.totalAmount, row.pricing.currency)}
              </span>
            ),
          },
        ]}
        actions={(row) => [
          {
            label: "View details",
            href: customerPaths.order(row.id),
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
          ...(row.invoiceId
            ? [
                {
                  label: "Invoice",
                  href: customerPaths.invoice(row.invoiceId),
                  icon: <Receipt className="size-3.5" />,
                },
              ]
            : []),
          ...(row.estimateId
            ? [
                {
                  label: "Estimate",
                  href: customerPaths.estimate(row.estimateId),
                  icon: <FileText className="size-3.5" />,
                },
              ]
            : []),
        ]}
      />
    </PortalPage>
  );
}
