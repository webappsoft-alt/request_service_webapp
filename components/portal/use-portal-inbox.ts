"use client";

import { useMemo } from "react";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";

export function usePortalInbox() {
  const { requests } = usePortalWorkspace();
  const records = usePortalRecords();
  const chat = useChatThreads();
  const leads = records.listed("request", records.mergeRequests(requests), false);
  const newLeads = useMemo(
    () => leads.filter((item) => item.status === "new"),
    [leads],
  );

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

  return {
    newLeads: newLeads.length,
    unreadChats: chat.unread,
    total: newLeads.length + chat.unread,
    items,
  };
}
