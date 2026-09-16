"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { NoData } from "@/components/shared/no-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  orderStatusBadgeVariant,
} from "@/lib/orders/order-status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  CUSTOMER_ORDERS_PAGE_LIMIT,
  customerOrderDetailFromListItem,
  fetchCustomerOrders,
  selectCustomerOrders,
  selectCustomerOrdersError,
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

export function CustomerOrdersDashboardView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const orders = useAppSelector(selectCustomerOrders);
  const loading = useAppSelector(selectCustomerOrdersLoading);
  const error = useAppSelector(selectCustomerOrdersError);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const haystack = [
        orderServiceTitle(order),
        order.orderNumber,
        order.id,
        formatOrderStatus(order.status),
        formatOrderAddressLine(order.address),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search]);

  if (!auth.hydrated || (!isAuthenticated && !loading)) {
    return <CenteredSpinner label="Checking your account…" />;
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Orders"
      description="Booked fixed services and job requests. Open a row to view status, schedule, and actions."
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders…"
            className="h-9 bg-card pl-8"
            aria-label="Search orders"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full bg-card sm:ml-auto sm:w-48">
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

      <div className="overflow-hidden rounded-[4px] border border-black/10 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#e8eef5] text-[11px] tracking-[0.12em] text-[#003F7D] uppercase">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Service</th>
                <th className="px-3 py-2.5 font-semibold">Schedule</th>
                <th className="px-3 py-2.5 font-semibold">Location</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {loading && !filtered.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    Loading orders…
                  </td>
                </tr>
              ) : error && !filtered.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-black/10 hover:bg-[#f7f8fa]"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">{orderServiceTitle(order)}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {order.orderNumber || order.id}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {order.booking?.startTime
                        ? formatOrderDateTime(order.booking.startTime)
                        : "—"}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-muted-foreground">
                      <span className="line-clamp-2">
                        {formatOrderAddressLine(order.address) || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {formatOrderStatus(order.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-[#003F7D]">
                      {formatOrderMoney(
                        order.pricing.totalAmount,
                        order.pricing.currency,
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={customerPaths.order(order.id)}
                          onClick={() =>
                            dispatch(
                              setCustomerOrderDetail(
                                customerOrderDetailFromListItem(order),
                              ),
                            )
                          }
                        >
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8">
                    <NoData
                      title="No orders yet"
                      description="When you book a fixed service, it will appear in this table."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-black/10 px-3 py-2.5">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= pagination.totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PortalPage>
  );
}
