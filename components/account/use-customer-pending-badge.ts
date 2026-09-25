"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { listPublicChatThreads, getAdminDirectUnreadCount } from "@/lib/api/chat-client";
import {
  fetchNotifications,
  normalizeSocketNotification,
} from "@/lib/api/notifications-client";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";

/**
 * Unread notifications + unread chat messages for logged-in customers.
 * Same semantics as the CustomerShell header bell (pending attention).
 */
export function useCustomerPendingBadge(enabled = true) {
  const authUser = useAppSelector(selectAuthUser);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const isCustomer =
    enabled &&
    Boolean(authUser) &&
    String(authUser?.role || "customer").toLowerCase() !== "provider";

  const refreshChatBadge = useCallback(async () => {
    if (!isCustomer) {
      setUnreadMessages(0);
      return;
    }
    const email = String(authUser?.email || "").trim();
    if (!email) {
      setUnreadMessages(0);
      return;
    }
    try {
      const [threads, adminUnread] = await Promise.all([
        listPublicChatThreads(email, { silent: true }),
        getAdminDirectUnreadCount({ silent: true }),
      ]);
      const threadUnread = threads.reduce(
        (sum, thread) => sum + (thread.unreadForCustomer || 0),
        0,
      );
      setUnreadMessages(threadUnread + adminUnread);
    } catch {
      setUnreadMessages(0);
    }
  }, [authUser?.email, isCustomer]);

  const refreshNotifications = useCallback(async () => {
    if (!isCustomer) {
      setUnreadNotifications(0);
      return;
    }
    if (!authUser?.id && !authUser?.email) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const result = await fetchNotifications({
        page: 1,
        limit: 12,
        status: "all",
        silent: true,
        force: true,
      });
      setUnreadNotifications(result.unreadCount);
    } catch {
      // Keep last known count if the feed fails.
    }
  }, [authUser?.email, authUser?.id, isCustomer]);

  useEffect(() => {
    if (!isCustomer) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    void refreshChatBadge();
    void refreshNotifications();
  }, [isCustomer, refreshChatBadge, refreshNotifications]);

  useEffect(() => {
    if (!isCustomer) return;
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (
        type === "CHAT_MESSAGE" ||
        type === "CHAT_THREAD_UPDATED" ||
        type === "CHAT_READ_RECEIPT" ||
        type === "DIRECT_CHAT_MESSAGE" ||
        type === "DIRECT_CHAT_READ"
      ) {
        void refreshChatBadge();
      }
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (mapped && !mapped.isRead) {
          setUnreadNotifications((count) => count + 1);
        }
        void refreshNotifications();
        void refreshChatBadge();
        return;
      }
      if (
        type === "ORDER_UPDATED" ||
        type === "CUSTOMER_BADGE_INVALIDATE" ||
        type === "ESTIMATE_SENT" ||
        type === "INVOICE_SENT" ||
        type === "PAYMENT_RECEIVED" ||
        type === "SERVICE_SCHEDULED"
      ) {
        void refreshNotifications();
        if (
          type === "CUSTOMER_BADGE_INVALIDATE" ||
          type === "SERVICE_SCHEDULED" ||
          type === "ORDER_UPDATED"
        ) {
          void refreshChatBadge();
        }
      }
    });
  }, [isCustomer, refreshChatBadge, refreshNotifications]);

  const pendingCount = isCustomer ? unreadNotifications + unreadMessages : 0;

  return {
    pendingCount,
    unreadNotifications: isCustomer ? unreadNotifications : 0,
    unreadMessages: isCustomer ? unreadMessages : 0,
    refresh: useCallback(() => {
      void refreshChatBadge();
      void refreshNotifications();
    }, [refreshChatBadge, refreshNotifications]),
  };
}

export function formatPendingBadgeCount(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}
