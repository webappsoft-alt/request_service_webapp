"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import {
  listCustomerChangeOrders,
  type CustomerChangeOrder,
} from "@/lib/api/customer-change-orders";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";

function statusLabel(status: string) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
    case "pending_approval":
      return "Pending approval";
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

export function CustomerChangeOrdersView() {
  const [items, setItems] = useState<CustomerChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listCustomerChangeOrders()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(
    () =>
      items.filter((item) =>
        ["pending", "pending_approval"].includes(
          String(item.status || "").toLowerCase(),
        ),
      ),
    [items],
  );

  return (
    <PortalPage
      title="Change orders"
      description="Additional work requests from your service provider. Approve or reject before they proceed."
    >
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading change orders…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-soft px-4 py-10 text-center text-sm text-muted-foreground">
          No change orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">
                Action required — {pending.length} change{" "}
                {pending.length === 1 ? "order" : "orders"} awaiting your
                approval
              </p>
            </div>
          ) : null}
          <ul className="divide-y divide-border-soft rounded-md border border-border-soft">
            {items.map((co) => {
              const pendingCo = ["pending", "pending_approval"].includes(
                String(co.status || "").toLowerCase(),
              );
              return (
                <li
                  key={`${co.jobId}-${co.id}`}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{co.number}</span>
                      <StatusPill
                        label={statusLabel(co.status)}
                        tone={statusTone(co.status)}
                      />
                    </div>
                    <p className="truncate text-sm">{co.title || co.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Job {co.jobNumber || "—"}
                      {co.sentAt
                        ? ` · Sent ${formatShortDate(co.sentAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">
                      +{formatMoney(co.amount)}
                    </span>
                    <Button size="sm" className="h-8" asChild>
                      <Link
                        href={customerPaths.changeOrder(co.jobId, co.id)}
                      >
                        {pendingCo ? "Review" : "View"}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PortalPage>
  );
}
