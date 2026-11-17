"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { markDashboardActionsSeen } from "@/lib/api/crm-client";
import { dismissDashboardActions } from "@/store/dashboardSlice";
import { useAppDispatch } from "@/store/hooks";

/** Detail pages that count as "opened" for the dashboard's Daily alerts feed. */
const DETAIL_PAGE = /^\/pro\/dashboard\/(requests|new-estimate|jobs|invoices)\/([a-f0-9]{24})(?:\/|$)/;
const PAGE_KIND = {
  requests: { kind: "request", prefix: "lead" },
  "new-estimate": { kind: "estimate", prefix: "estimate" },
  jobs: { kind: "job", prefix: "job" },
  invoices: { kind: "invoice", prefix: "invoice" },
} as const;

/**
 * Opening a lead / estimate / job / invoice page from anywhere (the dashboard, a table, a link)
 * marks its Daily alerts item seen: it leaves the cached dashboard at once and the server keeps it
 * out until the record's status changes. Leads also turn "viewed" on their own when opened.
 */
export function DashboardSeenTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!enabled) return;
    const match = DETAIL_PAGE.exec(pathname || "");
    if (!match) return;
    const page = PAGE_KIND[match[1] as keyof typeof PAGE_KIND];
    const id = match[2];
    dispatch(
      dismissDashboardActions({
        ids: [`${page.prefix}:${id}`],
        // A job page also covers its change orders waiting to be billed.
        prefixes: page.kind === "job" ? [`co:${id}:`] : [],
      }),
    );
    void markDashboardActionsSeen({ records: [{ kind: page.kind, id }] }).catch(() => {});
  }, [enabled, pathname, dispatch]);

  // A lead opened elsewhere (another tab / the leads table preview) turns "viewed".
  useEffect(() => {
    if (!enabled) return;
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; payload?: { id?: string; status?: string } }>).detail;
      if (detail?.type !== "LEAD_STATUS_UPDATED") return;
      const id = String(detail.payload?.id || "");
      if (id && detail.payload?.status && detail.payload.status !== "new") {
        dispatch(dismissDashboardActions({ ids: [`lead:${id}`] }));
      }
    };
    window.addEventListener("rs-realtime", onRealtime);
    return () => window.removeEventListener("rs-realtime", onRealtime);
  }, [enabled, dispatch]);

  return null;
}
