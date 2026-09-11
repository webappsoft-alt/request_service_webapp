"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ImageGallerySlider } from "@/components/shared/image-gallery-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
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
import type { CustomerOrderListItem } from "@/lib/types/order-booking";
import {
  formatOrderMoney,
  formatOrderAddressLine,
  formatOrderDateTime,
  orderServiceTitle,
} from "@/lib/orders/order-display";
import {
  formatOrderStatus,
  orderStatusBadgeVariant,
} from "@/lib/orders/order-status";
import { cn } from "@/lib/utils";

function OrdersPagination({
  page,
  pageCount,
  totalDocs,
  limit,
  onPage,
}: {
  page: number;
  pageCount: number;
  totalDocs: number;
  limit: number;
  onPage: (next: number) => void;
}) {
  if (pageCount <= 1 && totalDocs <= limit) return null;

  const from = totalDocs === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalDocs);

  return (
    <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="font-medium text-foreground">{totalDocs}</span>
      </p>
      {pageCount > 1 ? (
        <nav
          aria-label="Orders pagination"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (number) => (
              <Button
                key={number}
                variant={number === page ? "default" : "outline"}
                size="icon"
                aria-label={`Page ${number}`}
                aria-current={number === page ? "page" : undefined}
                onClick={() => onPage(number)}
              >
                {number}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  onOpen,
}: {
  order: CustomerOrderListItem;
  onOpen: (order: CustomerOrderListItem) => void;
}) {
  const href = `/account/orders/${order.id}`;
  const title = orderServiceTitle(order);
  const images = order.service?.images?.filter(Boolean) ?? [];
  const address = formatOrderAddressLine(order.address);
  const startDate = order.booking?.startTime
    ? formatOrderDateTime(order.booking.startTime)
    : null;

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card",
        "animate-in fade-in-0 zoom-in-95 duration-300",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-foreground/35 hover:shadow-sm",
      )}
    >
      <Badge
        variant={orderStatusBadgeVariant(order.status)}
        className="absolute right-3 top-3 z-10 shadow-sm"
      >
        {formatOrderStatus(order.status)}
      </Badge>

      <div className="relative">
        <ImageGallerySlider
          images={images}
          alt={title}
          compact
          className="[&>div:first-child]:rounded-none [&>div:first-child]:border-0 [&>div:first-child]:border-b"
        />
        {order.service?.category ? (
          <div className="absolute left-3 top-3 z-10">
            <Badge variant="secondary" className="bg-background/95 shadow-sm">
              {order.service.category}
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {order.orderNumber || order.id}
          </p>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          {startDate ? (
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-3.5 shrink-0" />
              <span className="text-foreground">{startDate}</span>
            </div>
          ) : null}
          {address ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{address}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-base font-semibold text-primary">
            {formatOrderMoney(
              order.pricing.totalAmount,
              order.pricing.currency,
            )}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={href} onClick={() => onOpen(order)}>
              View details
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function CustomerOrdersView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const orders = useAppSelector(selectCustomerOrders);
  const pagination = useAppSelector(selectCustomerOrdersPagination);
  const loading = useAppSelector(selectCustomerOrdersLoading);
  const error = useAppSelector(selectCustomerOrdersError);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent("/account/orders")}`);
    }
  }, [auth.hydrated, isAuthenticated, router]);

  const loadOrders = useCallback(
    (nextPage: number) => {
      void dispatch(
        fetchCustomerOrders({
          page: nextPage,
          limit: CUSTOMER_ORDERS_PAGE_LIMIT,
        }),
      );
    },
    [dispatch],
  );

  useEffect(() => {
    if (!auth.hydrated || !isAuthenticated) return;
    loadOrders(page);
  }, [auth.hydrated, isAuthenticated, page, loadOrders]);

  const openOrder = useCallback(
    (order: CustomerOrderListItem) => {
      dispatch(setCustomerOrderDetail(customerOrderDetailFromListItem(order)));
    },
    [dispatch],
  );

  if (!auth.hydrated || !isAuthenticated) {
    return (
      <Section tone="muted">
        <Container>
          <CenteredSpinner label="Loading orders" className="min-h-64" />
        </Container>
      </Section>
    );
  }

  const showInitialLoading = loading && !orders.length && !error;
  const pageCount = Math.max(1, pagination.totalPages || 1);
  const currentPage = Math.max(1, pagination.page || page);
  const limit = Math.max(1, pagination.limit || CUSTOMER_ORDERS_PAGE_LIMIT);
  const totalDocs = Math.max(0, pagination.totalDocs || orders.length);

  return (
    <Section tone="muted">
      <Container className="max-w-6xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Track bookings, appointments, and status for every service you
            requested.
          </p>
        </div>

        {showInitialLoading ? (
          <CenteredSpinner label="Loading orders" className="min-h-64" />
        ) : error && !orders.length ? (
          <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              Couldn’t load your orders
            </p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {error}
            </p>
            <Button type="button" onClick={() => loadOrders(page)}>
              Try again
            </Button>
          </div>
        ) : !orders.length ? (
          <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">
                No orders yet
              </p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                When you book a fixed-price service, it will show up here with
                live status updates.
              </p>
            </div>
            <Button asChild>
              <Link href="/services">Browse services</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {error}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => loadOrders(page)}
                >
                  Retry
                </button>
              </div>
            ) : null}

            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} onOpen={openOrder} />
                </li>
              ))}
            </ul>

            <OrdersPagination
              page={currentPage}
              pageCount={pageCount}
              totalDocs={totalDocs}
              limit={limit}
              onPage={(next) => setPage(next)}
            />
          </div>
        )}
      </Container>
    </Section>
  );
}
