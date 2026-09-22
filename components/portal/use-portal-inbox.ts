"use client";

import { useEffect, useMemo, useState } from "react";
import { providerOrdersApi } from "@/components/api/ApiRoutesFile";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { fetchNotifications } from "@/lib/api/notifications-client";
import { useAppSelector } from "@/store/hooks";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Count BOOKING_REQUESTED orders from the provider orders API (same source as the list). */
async function fetchPendingOrderCount(): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred http
    const { getData } = require("@/components/api/apiFuntions") as typeof import("@/components/api/apiFuntions");
    const response = await getData(
      providerOrdersApi.list,
      { page: 1, limit: 1, status: "BOOKING_REQUESTED" },
      { silent: true, force: true },
    );
    const root = asRecord(response) ?? {};
    const pagination =
      asRecord(root.pagination) ?? asRecord(asRecord(root.data)?.pagination) ?? {};
    const total = Number(pagination.total ?? pagination.totalDocs ?? 0);
    if (Number.isFinite(total) && total >= 0) return total;

    const rows = Array.isArray(root.data)
      ? root.data
      : Array.isArray(asRecord(root.data)?.orders)
        ? (asRecord(root.data)?.orders as unknown[])
        : [];
    return rows.filter(
      (row) => String(asRecord(row)?.status || "") === "BOOKING_REQUESTED",
    ).length;
  } catch {
    return 0;
  }
}

export function usePortalInbox() {
  const { requests } = usePortalWorkspace();
  const records = usePortalRecords();
  const chat = useChatThreads();
  const crm = useCrmApiData();
  const providerOrders = useAppSelector((state) => state.providerOrders);
  const [unreadLeadNotifs, setUnreadLeadNotifs] = useState(0);
  const [unreadChatNotifs, setUnreadChatNotifs] = useState(0);
  const [unreadBookingNotifs, setUnreadBookingNotifs] = useState(0);
  const [liveLeadBump, setLiveLeadBump] = useState(0);
  const [liveOrderBump, setLiveOrderBump] = useState(0);
  const [pendingFromApi, setPendingFromApi] = useState(0);
  /** After visiting Leads, hide status-based count until a new lead arrives. */
  const [leadsBadgeCleared, setLeadsBadgeCleared] = useState(false);

  const leads = records.listed("request", records.mergeRequests(requests), false);
  const newLeads = useMemo(
    () => leads.filter((item) => item.status === "new"),
    [leads],
  );

  const pendingFromStore = useMemo(() => {
    const items = providerOrders?.items || [];
    const fromItems = items.filter((row) => row.status === "BOOKING_REQUESTED").length;
    const cache = providerOrders?.pagesCache || {};
    const seen = new Set<string>();
    let fromCache = 0;
    for (const rows of Object.values(cache)) {
      for (const row of rows) {
        if (row.status !== "BOOKING_REQUESTED") continue;
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        fromCache += 1;
      }
    }
    // Prefer the dedicated Requested filter cache when present.
    const requestedKey = Object.keys(cache).find((key) =>
      key.startsWith("BOOKING_REQUESTED|"),
    );
    if (requestedKey && cache[requestedKey]) {
      return Math.max(
        fromItems,
        cache[requestedKey].filter((row) => row.status === "BOOKING_REQUESTED").length,
        providerOrders?.statusFilter === "BOOKING_REQUESTED"
          ? providerOrders.total || 0
          : 0,
      );
    }
    return Math.max(fromItems, fromCache);
  }, [providerOrders]);

  const refreshPendingOrders = async () => {
    const count = await fetchPendingOrderCount();
    setPendingFromApi(count);
    if (count > 0) setLiveOrderBump(0);
  };

  const refreshNotifBadges = async () => {
    try {
      const result = await fetchNotifications({
        page: 1,
        limit: 50,
        status: "unread",
        silent: true,
        force: true,
      });
      setUnreadLeadNotifs(result.items.filter((item) => item.type === "NEW_LEAD").length);
      setUnreadChatNotifs(
        result.items.filter((item) => item.type === "NEW_CHAT_MESSAGE").length,
      );
      setUnreadBookingNotifs(
        result.items.filter(
          (item) =>
            item.type === "NEW_BOOKING_REQUEST" ||
            (/BOOKING|ORDER/i.test(item.type) &&
              /request|review|booked/i.test(`${item.title} ${item.message}`)),
        ).length,
      );
    } catch {
      /* keep last */
    }
  };

  useEffect(() => {
    void refreshNotifBadges();
    void refreshPendingOrders();
  }, []);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "LEAD_CREATED") {
        setLeadsBadgeCleared(false);
        setLiveLeadBump((count) => count + 1);
        void refreshNotifBadges();
        return;
      }
      if (type === "LEADS_TAB_OPENED") {
        setLeadsBadgeCleared(true);
        setUnreadLeadNotifs(0);
        setLiveLeadBump(0);
        return;
      }
      if (type === "ORDER_UPDATED") {
        const status = String(detail?.payload?.status || "");
        const action = String(detail?.payload?.action || "");
        if (
          (status === "BOOKING_REQUESTED" || action === "requested") &&
          action !== "auto_confirm"
        ) {
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
        void refreshNotifBadges();
        void refreshPendingOrders();
        return;
      }
      if (type === "NEW_NOTIFICATION") {
        const payload = detail?.payload as
          | { type?: string; data?: { status?: string; action?: string } }
          | undefined;
        const notifType = String(payload?.type || "");
        const notifAction = String(payload?.data?.action || "");
        const notifStatus = String(payload?.data?.status || "");
        if (
          notifType === "NEW_BOOKING_REQUEST" &&
          notifAction !== "auto_confirm" &&
          notifStatus !== "CONFIRMED"
        ) {
          setLiveOrderBump((count) => count + 1);
        }
        if (
          notifType === "BOOKING_ACCEPTED" ||
          notifType === "BOOKING_REJECTED"
        ) {
          setLiveOrderBump(0);
        }
        void refreshNotifBadges();
        void refreshPendingOrders();
        return;
      }
      if (
        type === "INBOX_SUMMARY_INVALIDATE" ||
        type === "CHAT_MESSAGE" ||
        type === "CHAT_THREAD_UPDATED" ||
        type === "CHAT_READ_RECEIPT"
      ) {
        void refreshNotifBadges();
        if (type === "INBOX_SUMMARY_INVALIDATE") {
          void refreshPendingOrders();
        }
      }
    });
  }, []);

  // When CRM summary or list catches up, drop optimistic bumps.
  useEffect(() => {
    if ((crm.inboxSummary?.pendingOrders || 0) > 0 || pendingFromApi > 0 || pendingFromStore > 0) {
      setLiveOrderBump(0);
    }
  }, [crm.inboxSummary?.pendingOrders, pendingFromApi, pendingFromStore]);

  const items = useMemo(() => {
    const leadItems = newLeads.map((item) => ({
      id: `lead:${item.id}`,
      href: `/pro/dashboard/requests/${item.id}`,
      title: `${item.customerName} requested ${item.serviceName}`,
      detail: item.details,
      kind: "lead" as const,
    }));
    const chatItems = chat.threads
      .filter((item) => item.unreadForProvider > 0)
      .map((item) => ({
        id: `chat:${item.id}`,
        href: `/pro/dashboard/messages?thread=${item.id}`,
        title: `${item.customerName} sent a message`,
        detail: item.messages.at(-1)?.text || "New chat",
        kind: "chat" as const,
      }));
    return [...chatItems, ...leadItems];
  }, [chat.threads, newLeads]);

  const summaryLeads = crm.enabled ? crm.inboxSummary.newLeads || 0 : 0;
  const newLeadCount = leadsBadgeCleared
    ? Math.max(unreadLeadNotifs, liveLeadBump)
    : Math.max(summaryLeads, newLeads.length, unreadLeadNotifs, liveLeadBump);

  const unreadChats = Math.max(
    chat.threads.length > 0
      ? chat.unread
      : crm.enabled
        ? crm.inboxSummary.unreadChats || 0
        : chat.unread,
    unreadChatNotifs,
  );

  // Prefer live Requested order count (same as Leads counting "new"), then notifs/bumps.
  const pendingOrders = Math.max(
    pendingFromApi,
    pendingFromStore,
    crm.enabled ? crm.inboxSummary.pendingOrders || 0 : 0,
    unreadBookingNotifs,
    liveOrderBump,
  );

  return {
    newLeads: newLeadCount,
    unreadChats,
    pendingOrders,
    total: newLeadCount + unreadChats + pendingOrders,
    items,
  };
}
