"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyPortalInboxCounts,
  bumpPortalInboxCount,
  clearPortalInboxCount,
  getPortalInboxCounts,
  subscribePortalInboxCounts,
  type PortalInboxCounts,
} from "@/components/portal/portal-inbox-counts-store";
import {
  getPortalInboxClearState,
  reopenPortalInboxBadge,
  setPortalInboxCleared,
  subscribePortalInboxClears,
} from "@/components/portal/portal-inbox-clears";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import {
  ackProviderInboxBadges,
  onSocketEvent,
  requestProviderInboxCounts,
} from "@/components/socket";

/** Marketplace / chat / quote intake — not provider-added CRM leads. */
const CUSTOMER_LEAD_SOURCES = new Set([
  "quote_request",
  "profile_view",
  "fixed_service_view",
  "direct_message",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function countsFromPayload(payload: unknown): Partial<PortalInboxCounts> | null {
  const row = asRecord(payload);
  if (!row) return null;
  return {
    newLeads: Number(row.newLeads) || 0,
    unreadChats: Number(row.unreadChats) || 0,
    pendingOrders: Number(row.pendingOrders) || 0,
    pendingEstimates: Number(row.pendingEstimates) || 0,
  };
}

function isCustomerLeadPayload(payload: Record<string, unknown> | null) {
  if (!payload) return true;
  const source = String(payload.source || "").trim().toLowerCase();
  if (!source) return true;
  return CUSTOMER_LEAD_SOURCES.has(source);
}

/**
 * Sidebar / subnav badge counts.
 * Source of truth: module store fed by `provider:inbox-counts` (socket only).
 * Live bumps cover the gap until the next socket apply.
 *
 * Estimates badge = customer `changes_requested` only (never provider drafts).
 * Leads badge = customer-originated sources only.
 */
export function usePortalInbox() {
  const { requests } = usePortalWorkspace();
  const records = usePortalRecords();
  const [counts, setCounts] = useState(getPortalInboxCounts);
  /** Shared across remounts — visiting a tab dismisses dashboard alerts only. */
  const [, setClears] = useState(getPortalInboxClearState);

  const leads = records.listed("request", records.mergeRequests(requests), false);
  const newLeads = useMemo(
    () =>
      leads.filter((item) => {
        if (item.status !== "new") return false;
        const source = String(item.source || "").trim().toLowerCase();
        if (!source) return true;
        return CUSTOMER_LEAD_SOURCES.has(source);
      }),
    [leads],
  );

  useEffect(() => {
    return subscribePortalInboxCounts(() => {
      setCounts(getPortalInboxCounts());
    });
  }, []);

  useEffect(() => {
    return subscribePortalInboxClears(() => {
      setClears(getPortalInboxClearState());
    });
  }, []);

  // Direct socket subscription — do not depend on CrmDataProvider context.
  useEffect(() => {
    requestProviderInboxCounts();
    const off = onSocketEvent("provider:inbox-counts", (payload) => {
      const next = countsFromPayload(payload);
      if (next) applyPortalInboxCounts(next);
    });
    const t1 = window.setTimeout(() => requestProviderInboxCounts(), 300);
    const t2 = window.setTimeout(() => requestProviderInboxCounts(), 1200);
    return () => {
      off();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "LEAD_CREATED") {
        const payload = asRecord(detail?.payload);
        if (!isCustomerLeadPayload(payload)) return;
        reopenPortalInboxBadge("leads");
        bumpPortalInboxCount("newLeads", 1);
        return;
      }
      if (type === "LEADS_TAB_OPENED") {
        setPortalInboxCleared("leads", true);
        clearPortalInboxCount("newLeads");
        ackProviderInboxBadges(["leads"]);
        return;
      }
      if (type === "ORDERS_TAB_OPENED") {
        setPortalInboxCleared("orders", true);
        clearPortalInboxCount("pendingOrders");
        ackProviderInboxBadges(["orders"]);
        return;
      }
      if (type === "ESTIMATES_TAB_OPENED") {
        setPortalInboxCleared("estimates", true);
        clearPortalInboxCount("pendingEstimates");
        ackProviderInboxBadges(["estimates"]);
        return;
      }
      if (
        type === "ESTIMATE_UPDATED" ||
        type === "ESTIMATE_SENT" ||
        type === "ESTIMATE_ACCEPTED" ||
        type === "ESTIMATE_CHANGES_REQUESTED"
      ) {
        const estimatePayload = asRecord(detail?.payload) ?? {};
        const status = String(estimatePayload.status || "").toLowerCase();
        // Only customer change-requests — never provider drafts.
        if (
          type === "ESTIMATE_CHANGES_REQUESTED" ||
          status === "changes_requested"
        ) {
          reopenPortalInboxBadge("estimates");
          bumpPortalInboxCount("pendingEstimates", 1);
        }
        return;
      }
      if (type === "ORDER_UPDATED") {
        const orderPayload = asRecord(detail?.payload) ?? {};
        const status = String(orderPayload.status || "");
        const action = String(orderPayload.action || "");
        if (
          (status === "BOOKING_REQUESTED" || action === "requested") &&
          action !== "auto_confirm"
        ) {
          reopenPortalInboxBadge("orders");
          bumpPortalInboxCount("pendingOrders", 1);
        } else if (
          status === "CONFIRMED" ||
          status === "CANCELLED" ||
          action === "accept" ||
          action === "reject" ||
          action === "auto_confirm"
        ) {
          bumpPortalInboxCount("pendingOrders", -1);
        }
        return;
      }
      if (type === "NEW_NOTIFICATION") {
        const payload = detail?.payload as
          | {
              type?: string;
              data?: { status?: string; action?: string; source?: string };
            }
          | undefined;
        const notifType = String(payload?.type || "");
        if (notifType === "NEW_BOOKING_REQUEST") {
          reopenPortalInboxBadge("orders");
          bumpPortalInboxCount("pendingOrders", 1);
        } else if (notifType === "NEW_LEAD") {
          const data = asRecord(payload?.data);
          if (!isCustomerLeadPayload(data)) return;
          reopenPortalInboxBadge("leads");
          bumpPortalInboxCount("newLeads", 1);
        } else if (notifType === "NEW_CHAT_MESSAGE") {
          bumpPortalInboxCount("unreadChats", 1);
        } else if (notifType === "ESTIMATE_CHANGES_REQUESTED") {
          reopenPortalInboxBadge("estimates");
          bumpPortalInboxCount("pendingEstimates", 1);
        }
        return;
      }
      if (type === "CHAT_MESSAGE" || type === "CHAT_THREAD_UPDATED") {
        bumpPortalInboxCount("unreadChats", 1);
        return;
      }
      if (type === "CHAT_READ_RECEIPT") {
        const payload = asRecord(detail?.payload) ?? {};
        const cleared = Math.max(0, Number(payload.clearedUnread) || 0);
        if (String(payload.readBy || "") === "provider" && cleared > 0) {
          bumpPortalInboxCount("unreadChats", -cleared);
        }
        return;
      }
      // Apply counts from the broadcast payload (do not wipe to zero).
      if (type === "INBOX_SUMMARY_APPLY") {
        const next = countsFromPayload(detail?.payload);
        if (next) applyPortalInboxCounts(next);
        return;
      }
      if (type === "INBOX_SUMMARY_INVALIDATE") {
        const payload = asRecord(detail?.payload) ?? {};
        if (String(payload.reason || "") === "INBOX_ACK") {
          const kinds = Array.isArray(payload.kinds)
            ? payload.kinds.map((k: unknown) => String(k || "").toLowerCase())
            : [];
          if (kinds.includes("leads")) clearPortalInboxCount("newLeads");
          if (kinds.includes("orders")) clearPortalInboxCount("pendingOrders");
          if (kinds.includes("estimates")) clearPortalInboxCount("pendingEstimates");
        } else {
          requestProviderInboxCounts();
        }
      }
      if (type === "SOCKET_RECONNECTED") {
        requestProviderInboxCounts();
      }
    });
  }, []);

  const items = useMemo(() => {
    return newLeads.slice(0, 8).map((item) => ({
      id: `lead:${item.id}`,
      href: `/pro/dashboard/requests/${item.id}`,
      title: `${item.customerName} requested ${item.serviceName}`,
      detail: item.details,
      kind: "lead" as const,
    }));
  }, [newLeads]);

  // Trust socket/ack counts — do not floor with local draft lists.
  const newLeadCount = counts.newLeads || 0;
  const unreadChats = counts.unreadChats || 0;
  const pendingOrders = counts.pendingOrders || 0;
  const pendingEstimates = counts.pendingEstimates || 0;

  return {
    newLeads: newLeadCount,
    unreadChats,
    pendingOrders,
    pendingEstimates,
    total: newLeadCount + unreadChats + pendingOrders + pendingEstimates,
    items,
  };
}
