"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPortalInboxClearState,
  reopenPortalInboxBadge,
  setPortalInboxCleared,
  subscribePortalInboxClears,
} from "@/components/portal/portal-inbox-clears";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Sidebar / subnav badge counts.
 * Counts come from CrmDataProvider.inboxSummary (loaded once + Socket updates).
 * Does NOT fetch chats, notifications, or orders lists on mount — those belong
 * to their own pages.
 */
export function usePortalInbox() {
  const { requests, estimates } = usePortalWorkspace();
  const records = usePortalRecords();
  const crm = useCrmApiData();
  const [liveLeadBump, setLiveLeadBump] = useState(0);
  const [liveOrderBump, setLiveOrderBump] = useState(0);
  const [liveEstimateBump, setLiveEstimateBump] = useState(0);
  const [liveChatBump, setLiveChatBump] = useState(0);
  /** Shared across remounts — visiting a tab clears badge + dashboard alert. */
  const [clears, setClears] = useState(getPortalInboxClearState);

  const leads = records.listed("request", records.mergeRequests(requests), false);
  const newLeads = useMemo(
    () => leads.filter((item) => item.status === "new"),
    [leads],
  );

  const listedEstimates = records.listed(
    "estimate",
    records.mergeEstimates(estimates),
    false,
  );
  const estimateAttention = useMemo(
    () => listedEstimates.filter((item) => item.status === "changes_requested"),
    [listedEstimates],
  );

  useEffect(() => {
    return subscribePortalInboxClears(() => {
      setClears(getPortalInboxClearState());
    });
  }, []);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "LEAD_CREATED") {
        reopenPortalInboxBadge("leads");
        setLiveLeadBump((count) => count + 1);
        return;
      }
      if (type === "LEADS_TAB_OPENED") {
        setPortalInboxCleared("leads", true);
        setLiveLeadBump(0);
        return;
      }
      if (type === "ORDERS_TAB_OPENED") {
        setPortalInboxCleared("orders", true);
        setLiveOrderBump(0);
        return;
      }
      if (type === "ESTIMATES_TAB_OPENED") {
        setPortalInboxCleared("estimates", true);
        setLiveEstimateBump(0);
        return;
      }
      if (
        type === "ESTIMATE_UPDATED" ||
        type === "ESTIMATE_SENT" ||
        type === "ESTIMATE_ACCEPTED"
      ) {
        const estimatePayload = asRecord(detail?.payload) ?? {};
        const status = String(estimatePayload.status || "").toLowerCase();
        if (status === "changes_requested" || status === "draft") {
          reopenPortalInboxBadge("estimates");
          setLiveEstimateBump((count) => count + 1);
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
          setLiveOrderBump((count) => count + 1);
        } else if (
          status === "CONFIRMED" ||
          status === "CANCELLED" ||
          action === "accept" ||
          action === "reject" ||
          action === "auto_confirm"
        ) {
          setLiveOrderBump(0);
        }
        return;
      }
      if (type === "NEW_NOTIFICATION") {
        const payload = detail?.payload as
          | { type?: string; data?: { status?: string; action?: string } }
          | undefined;
        const notifType = String(payload?.type || "");
        if (notifType === "NEW_BOOKING_REQUEST") {
          reopenPortalInboxBadge("orders");
          setLiveOrderBump((count) => count + 1);
        } else if (notifType === "NEW_LEAD") {
          reopenPortalInboxBadge("leads");
          setLiveLeadBump((count) => count + 1);
        } else if (notifType === "NEW_CHAT_MESSAGE") {
          setLiveChatBump((count) => count + 1);
        }
        return;
      }
      if (type === "CHAT_MESSAGE" || type === "CHAT_THREAD_UPDATED") {
        setLiveChatBump((count) => count + 1);
        return;
      }
      if (type === "CHAT_READ_RECEIPT") {
        const payload = asRecord(detail?.payload) ?? {};
        const cleared = Math.max(0, Number(payload.clearedUnread) || 0);
        if (String(payload.readBy || "") === "provider" && cleared > 0) {
          setLiveChatBump((count) => Math.max(0, count - cleared));
        }
        return;
      }
      if (type === "INBOX_SUMMARY_APPLY" || type === "INBOX_SUMMARY_INVALIDATE") {
        // Counts refreshed in CrmDataProvider — reset live bumps so summary wins.
        if (String(detail?.payload?.reason || "") === "INBOX_ACK") {
          const kinds = Array.isArray(detail?.payload?.kinds)
            ? detail.payload.kinds.map((k: unknown) => String(k || "").toLowerCase())
            : [];
          if (kinds.includes("leads")) setLiveLeadBump(0);
          if (kinds.includes("orders")) setLiveOrderBump(0);
          if (kinds.includes("estimates")) setLiveEstimateBump(0);
        } else {
          setLiveLeadBump(0);
          setLiveOrderBump(0);
          setLiveEstimateBump(0);
          setLiveChatBump(0);
        }
      }
    });
  }, []);

  useEffect(() => {
    if ((crm.inboxSummary?.pendingOrders || 0) > 0) {
      setLiveOrderBump(0);
    }
  }, [crm.inboxSummary?.pendingOrders]);

  const items = useMemo(() => {
    return newLeads.slice(0, 8).map((item) => ({
      id: `lead:${item.id}`,
      href: `/pro/dashboard/requests/${item.id}`,
      title: `${item.customerName} requested ${item.serviceName}`,
      detail: item.details,
      kind: "lead" as const,
    }));
  }, [newLeads]);

  const summaryLeads = crm.enabled ? crm.inboxSummary.newLeads || 0 : 0;
  const newLeadCount = clears.leads
    ? liveLeadBump
    : Math.max(summaryLeads, liveLeadBump);

  const unreadChats = Math.max(
    crm.enabled ? crm.inboxSummary.unreadChats || 0 : 0,
    liveChatBump,
  );

  const pendingOrdersRaw = Math.max(
    crm.enabled ? crm.inboxSummary.pendingOrders || 0 : 0,
    liveOrderBump,
  );
  const pendingOrders = clears.orders ? liveOrderBump : pendingOrdersRaw;

  const pendingEstimatesRaw = Math.max(
    estimateAttention.length,
    liveEstimateBump,
  );
  const pendingEstimates = clears.estimates
    ? liveEstimateBump
    : pendingEstimatesRaw;

  return {
    newLeads: newLeadCount,
    unreadChats,
    pendingOrders,
    pendingEstimates,
    total: newLeadCount + unreadChats + pendingOrders + pendingEstimates,
    items,
  };
}
