"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, FileText, Inbox } from "lucide-react";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { cn } from "@/lib/utils";

type AlertTone = "leads" | "estimates" | "orders";

type AlertRow = {
  id: AlertTone;
  count: number;
  label: string;
  href: string;
  cta: string;
  icon: typeof Inbox;
};

const toneClass: Record<AlertTone, string> = {
  leads: "dashboard-alert--leads",
  estimates: "dashboard-alert--estimates",
  orders: "dashboard-alert--orders",
};

function plural(count: number, singular: string, pluralLabel: string) {
  return count === 1 ? singular : pluralLabel;
}

/**
 * Compact animated attention bars under the dashboard greeting.
 * Cleared when the matching Leads / Estimates / Orders tab is opened.
 */
export function DashboardActionAlerts() {
  const inbox = usePortalInbox();

  const rows: AlertRow[] = [];
  if (inbox.newLeads > 0) {
    rows.push({
      id: "leads",
      count: inbox.newLeads,
      label: `You have ${inbox.newLeads} new ${plural(inbox.newLeads, "lead request", "lead requests")}`,
      href: "/pro/dashboard/requests?status=new",
      cta: plural(inbox.newLeads, "View Lead", "View Leads"),
      icon: Inbox,
    });
  }
  if (inbox.pendingEstimates > 0) {
    rows.push({
      id: "estimates",
      count: inbox.pendingEstimates,
      label: `You have ${inbox.pendingEstimates} new ${plural(inbox.pendingEstimates, "estimate request", "estimate requests")}`,
      href: "/pro/dashboard/estimates?status=changes_requested",
      cta: plural(inbox.pendingEstimates, "View Request", "View Requests"),
      icon: FileText,
    });
  }
  if (inbox.pendingOrders > 0) {
    rows.push({
      id: "orders",
      count: inbox.pendingOrders,
      label: `You have ${inbox.pendingOrders} new ${plural(inbox.pendingOrders, "fixed service booking", "fixed service bookings")}`,
      href: "/pro/dashboard/orders?status=BOOKING_REQUESTED",
      cta: plural(inbox.pendingOrders, "View Booking", "View Bookings"),
      icon: ClipboardList,
    });
  }

  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-2" role="region" aria-label="Action alerts">
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <div
            key={row.id}
            className={cn(
              "dashboard-action-alert group relative flex items-center gap-3 overflow-hidden",
              "rounded-lg border px-3 py-2 pl-3.5 backdrop-blur-[2px]",
              toneClass[row.id],
              index === 1 && "dashboard-action-alert-delay-1",
              index === 2 && "dashboard-action-alert-delay-2",
            )}
          >
            <span aria-hidden className="dashboard-action-alert-rail" />
            <span
              aria-hidden
              className="dashboard-action-alert-sheen pointer-events-none absolute inset-0"
            />
            <span className="dashboard-action-alert-icon relative flex size-7 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-3.5" aria-hidden />
              <span aria-hidden className="dashboard-action-alert-ping" />
            </span>
            <p className="relative min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
              {row.label}
            </p>
            <Link href={row.href} className="dashboard-action-alert-cta relative">
              {row.cta}
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
