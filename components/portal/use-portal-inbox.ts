"use client";

import { useEffect, useMemo, useState } from "react";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { fetchNotifications } from "@/lib/api/notifications-client";

export function usePortalInbox() {
  const { requests } = usePortalWorkspace();
  const records = usePortalRecords();
  const chat = useChatThreads();
  const crm = useCrmApiData();
  const [unreadLeadNotifs, setUnreadLeadNotifs] = useState(0);
  const [unreadChatNotifs, setUnreadChatNotifs] = useState(0);
  const [liveLeadBump, setLiveLeadBump] = useState(0);
  /** After visiting Leads, hide status-based count until a new lead arrives. */
  const [leadsBadgeCleared, setLeadsBadgeCleared] = useState(false);

  const leads = records.listed("request", records.mergeRequests(requests), false);
  const newLeads = useMemo(
    () => leads.filter((item) => item.status === "new"),
    [leads],
  );

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
    } catch {
      /* keep last */
    }
  };

  useEffect(() => {
    void refreshNotifBadges();
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
        // Sidebar badge only — do not touch lead statuses or trigger list loading.
        setLeadsBadgeCleared(true);
        setUnreadLeadNotifs(0);
        setLiveLeadBump(0);
        return;
      }
      if (
        type === "NEW_NOTIFICATION" ||
        type === "INBOX_SUMMARY_INVALIDATE" ||
        type === "CHAT_MESSAGE" ||
        type === "CHAT_THREAD_UPDATED" ||
        type === "CHAT_READ_RECEIPT"
      ) {
        void refreshNotifBadges();
      }
    });
  }, []);

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
  // Sidebar Leads badge: unseen activity only. Opening the tab clears it without
  // changing lead status (new → viewed still happens only on row/detail open).
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

  return {
    newLeads: newLeadCount,
    unreadChats,
    pendingOrders: crm.enabled ? crm.inboxSummary.pendingOrders : 0,
    total: newLeadCount + unreadChats,
    items,
  };
}
