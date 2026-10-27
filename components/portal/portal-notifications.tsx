"use client";

import { useEffect } from "react";
import {
  NotificationBell,
  isViewingNotificationChat,
} from "@/components/notifications/notification-bell";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import {
  type AppNotification,
  markUnreadBookingNotificationsRead,
  markUnreadLeadNotificationsRead,
  notificationHref,
} from "@/lib/api/notifications-client";

function providerTitle(item: AppNotification) {
  if (item.type === "NEW_LEAD") return "New lead";
  if (item.type === "NEW_CHAT_MESSAGE") return "New message";
  if (item.type === "NEW_BOOKING_REQUEST") return "New booking request";
  if (item.type === "BOOKING_ACCEPTED") return "Booking accepted";
  if (item.type === "BOOKING_REJECTED") return "Booking declined";
  return item.title.replace(/^New quote request$/i, "New lead");
}

const providerHref = (item: AppNotification) => notificationHref(item, "provider");

/** Pro portal header bell. */
export function PortalNotifications() {
  // Opening Leads / Fixed service orders reads those notifications on the server,
  // so the bell (in every tab) drops by exactly that many and stays down after a refresh.
  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "LEADS_TAB_OPENED") void markUnreadLeadNotificationsRead().catch(() => undefined);
      if (type === "ORDERS_TAB_OPENED") void markUnreadBookingNotificationsRead().catch(() => undefined);
    });
  }, []);

  return (
    <NotificationBell
      title="Inbox"
      hrefFor={providerHref}
      itemTitle={providerTitle}
      autoReadWhen={isViewingNotificationChat}
      emptyText="No notifications yet."
    />
  );
}
