"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  MessageCircle,
  Settings,
} from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPublicChatThreads } from "@/lib/api/chat-client";
import { loadRememberedCustomerEstimates } from "@/lib/api/customer-estimates";
import { customerPaths } from "@/lib/customer-paths";
import { formatOrderMoney, orderServiceTitle } from "@/lib/orders/order-display";
import { formatOrderStatus } from "@/lib/orders/order-status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import {
  fetchCustomerOrders,
  selectCustomerOrders,
  selectCustomerOrdersLoading,
  selectCustomerOrdersPagination,
} from "@/store/ordersSlice";

type EstimateRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: number;
  shareToken: string;
  provider?: { companyName?: string } | null;
};

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[4px] border border-black/10 bg-card p-4 transition-colors hover:border-black/25"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#003F7D]">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Link>
  );
}

export function CustomerDashboardView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const orders = useAppSelector(selectCustomerOrders);
  const ordersLoading = useAppSelector(selectCustomerOrdersLoading);
  const pagination = useAppSelector(selectCustomerOrdersPagination);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [estimatesLoading, setEstimatesLoading] = useState(true);

  const firstName =
    String(user?.firstName || "").trim() ||
    String(user?.email || "there").split("@")[0];

  useEffect(() => {
    void dispatch(fetchCustomerOrders({ page: 1, limit: 5 }));
  }, [dispatch]);

  useEffect(() => {
    const email = String(user?.email || "").trim();
    if (!email) return;
    let cancelled = false;
    void (async () => {
      try {
        const threads = await listPublicChatThreads(email, { silent: true });
        if (!cancelled) {
          setUnreadMessages(
            threads.reduce(
              (sum, thread) => sum + (thread.unreadForCustomer || 0),
              0,
            ),
          );
        }
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setEstimatesLoading(true);
      try {
        const list = await loadRememberedCustomerEstimates();
        if (!cancelled) {
          setEstimates(
            list.map((item) => ({
              id: item.id,
              number: item.number,
              title: item.title,
              status: item.status,
              total: item.total,
              shareToken: item.shareToken,
              provider: item.provider
                ? { companyName: item.provider.companyName }
                : null,
            })),
          );
        }
      } catch {
        if (!cancelled) setEstimates([]);
      } finally {
        if (!cancelled) setEstimatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !["SETTLED", "CANCELLED", "DISPUTED"].includes(
            String(order.status || "").toUpperCase(),
          ),
      ).length,
    [orders],
  );

  const pendingEstimates = useMemo(
    () =>
      estimates.filter((item) =>
        ["sent", "finalized", "changes_requested"].includes(item.status),
      ).length,
    [estimates],
  );

  return (
    <PortalPage
      eyebrow="Home"
      title={`Welcome back, ${firstName}`}
      description="Track orders, review estimates from professionals, and message providers — without leaving your account."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.site}>
            Browse services
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders"
          value={ordersLoading ? "…" : pagination.totalDocs || orders.length}
          hint={
            openOrders
              ? `${openOrders} in progress`
              : "Booked fixed services & jobs"
          }
          href={customerPaths.orders}
        />
        <StatCard
          label="Estimates"
          value={estimatesLoading ? "…" : estimates.length}
          hint={
            pendingEstimates
              ? `${pendingEstimates} awaiting your review`
              : "Proposals from professionals"
          }
          href={customerPaths.estimates}
        />
        <StatCard
          label="Messages"
          value={unreadMessages}
          hint={unreadMessages ? "Unread conversations" : "Chat with pros"}
          href={customerPaths.messages}
        />
        <StatCard
          label="Profile"
          value="Account"
          hint="Update contact & password"
          href={customerPaths.settings}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="border-black/10 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-black/10 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-[#003F7D]" aria-hidden />
              Recent orders
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={customerPaths.orders}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-3">
            {ordersLoading && !orders.length ? (
              <p className="text-sm text-muted-foreground">Loading orders…</p>
            ) : orders.length ? (
              <ul className="divide-y divide-black/10">
                {orders.slice(0, 5).map((order) => (
                  <li key={order.id}>
                    <Link
                      href={customerPaths.order(order.id)}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#f7f8fa]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {orderServiceTitle(order)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatOrderStatus(order.status)}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[#003F7D]">
                        {formatOrderMoney(
                          order.pricing.totalAmount,
                          order.pricing.currency,
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No orders yet. Browse services on the main site to book a pro.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-black/10 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-black/10 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-[#003F7D]" aria-hidden />
              Estimates to review
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={customerPaths.estimates}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-3">
            {estimatesLoading && !estimates.length ? (
              <p className="text-sm text-muted-foreground">Loading estimates…</p>
            ) : estimates.length ? (
              <ul className="divide-y divide-black/10">
                {estimates.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={
                        item.shareToken
                          ? customerPaths.estimate(item.shareToken)
                          : customerPaths.estimates
                      }
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#f7f8fa]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {item.title || item.number || "Estimate"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.provider?.companyName || "Professional"} ·{" "}
                          {item.status}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[#003F7D]">
                        {formatOrderMoney(item.total, "USD")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                When a professional sends you an estimate link, open it to
                review and sign — it will show up here afterward.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.messages}>
            <MessageCircle data-icon="inline-start" />
            Messages
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.settings}>
            <Settings data-icon="inline-start" />
            Settings
          </Link>
        </Button>
      </div>
    </PortalPage>
  );
}
