import { notificationsApi } from "@/components/api/ApiRoutesFile";

function http() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred to break circular import
  return require("@/components/api/apiFuntions") as typeof import("@/components/api/apiFuntions");
}

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string;
  href?: string;
};

export type NotificationsListResult = {
  items: AppNotification[];
  unreadCount: number;
  page: number;
  totalPages: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mapNotification(raw: unknown): AppNotification | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = String(row.id || row._id || "").trim();
  if (!id) return null;
  const data = asRecord(row.data) || {};
  const href =
    (typeof data.href === "string" && data.href) ||
    (typeof data.absoluteShareUrl === "string" && data.absoluteShareUrl) ||
    (typeof data.shareUrl === "string" && data.shareUrl) ||
    undefined;
  return {
    id,
    type: String(row.type || "SYSTEM_ALERT"),
    title: String(row.title || "Notification"),
    message: String(row.message || ""),
    data,
    isRead: Boolean(row.isRead),
    readAt: row.readAt ? String(row.readAt) : null,
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    href,
  };
}

/** Normalize socket NEW_NOTIFICATION payloads (flat or `{ notification }`). */
export function normalizeSocketNotification(raw: unknown): AppNotification | null {
  const root = asRecord(raw) || {};
  const nested = asRecord(root.notification);
  const source = nested || root;
  const mapped = mapNotification({
    ...source,
    title: root.title || source.title,
    message: root.message || source.message,
    type: root.type || source.type,
    data: asRecord(root.data) || asRecord(source.data) || {},
  });
  return mapped;
}

export async function fetchNotifications(query: {
  page?: number;
  limit?: number;
  status?: "all" | "unread" | "read";
  silent?: boolean;
  force?: boolean;
} = {}): Promise<NotificationsListResult> {
  const response = await http().getData(
    notificationsApi.list,
    {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status ?? "all",
    },
    { silent: query.silent ?? true, force: query.force ?? true },
  );
  const root = asRecord(response) || {};
  const data = asRecord(root.data) || root;
  const list = Array.isArray(data.notifications)
    ? data.notifications
    : Array.isArray(root.notifications)
      ? root.notifications
      : Array.isArray(data.items)
        ? data.items
        : [];
  const items = list
    .map(mapNotification)
    .filter((item): item is AppNotification => Boolean(item));
  const pagination = asRecord(data.pagination) || asRecord(root.pagination) || {};
  return {
    items,
    unreadCount: Number(data.unreadCount ?? root.unreadCount ?? 0) || 0,
    page: Number(pagination.currentPage ?? query.page ?? 1) || 1,
    totalPages: Number(pagination.totalPages ?? 1) || 1,
  };
}

export async function markNotificationRead(id: string) {
  const response = await http().putData(
    notificationsApi.markRead(id),
    undefined,
    { silent: true },
  );
  const root = asRecord(response) || {};
  const data = asRecord(root.data) || root;
  return {
    notification: mapNotification(data.notification),
    unreadCount: Number(data.unreadCount ?? 0) || 0,
  };
}

export async function markAllNotificationsRead() {
  const response = await http().putData(
    notificationsApi.markAllRead,
    undefined,
    { silent: true },
  );
  const root = asRecord(response) || {};
  const data = asRecord(root.data) || root;
  return {
    unreadCount: Number(data.unreadCount ?? 0) || 0,
  };
}

/** Mark unread NEW_LEAD notifications as read (e.g. when opening Leads tab). */
export async function markUnreadLeadNotificationsRead() {
  const unread = await fetchNotifications({
    page: 1,
    limit: 50,
    status: "unread",
    silent: true,
    force: true,
  });
  const leads = unread.items.filter((item) => item.type === "NEW_LEAD");
  if (!leads.length) {
    return { updatedCount: 0, unreadCount: unread.unreadCount };
  }
  await Promise.allSettled(leads.map((item) => markNotificationRead(item.id)));
  const refreshed = await fetchNotifications({
    page: 1,
    limit: 1,
    status: "unread",
    silent: true,
    force: true,
  });
  return { updatedCount: leads.length, unreadCount: refreshed.unreadCount };
}

/** Mark unread booking-request notifications as read (opening Fixed service orders). */
export async function markUnreadBookingNotificationsRead() {
  const unread = await fetchNotifications({
    page: 1,
    limit: 50,
    status: "unread",
    silent: true,
    force: true,
  });
  const bookings = unread.items.filter(
    (item) =>
      item.type === "NEW_BOOKING_REQUEST" ||
      (/BOOKING|ORDER/i.test(item.type) &&
        /request|review|booked/i.test(`${item.title} ${item.message}`)),
  );
  if (!bookings.length) {
    return { updatedCount: 0, unreadCount: unread.unreadCount };
  }
  await Promise.allSettled(bookings.map((item) => markNotificationRead(item.id)));
  const refreshed = await fetchNotifications({
    page: 1,
    limit: 1,
    status: "unread",
    silent: true,
    force: true,
  });
  return { updatedCount: bookings.length, unreadCount: refreshed.unreadCount };
}

export function notificationHref(
  item: AppNotification,
  portal: "customer" | "provider" = "customer",
): string {
  if (item.href) {
    if (portal === "provider" && item.href.startsWith("/account/")) {
      // Fall through to provider defaults when a customer path leaked in.
    } else {
      return item.href;
    }
  }
  const type = item.type;
  if (portal === "provider") {
    if (type === "NEW_LEAD") return "/pro/dashboard/requests?status=new";
    if (type === "NEW_CHAT_MESSAGE") return "/pro/dashboard/messages";
    if (type.startsWith("ESTIMATE") || type.includes("ESTIMATE")) {
      return "/pro/dashboard/estimates";
    }
    if (type.includes("INVOICE")) return "/pro/dashboard/invoices";
    if (type.includes("ORDER") || type.includes("BOOKING") || type.includes("WORK_")) {
      return "/pro/dashboard/orders";
    }
    return "/pro/dashboard";
  }
  if (type === "NEW_CHAT_MESSAGE") return "/account/dashboard/messages";
  if (type === "SERVICE_SCHEDULED") {
    const kind = String(item.data?.kind || "");
    if (kind === "estimate") return "/account/dashboard/estimates";
    return "/account/dashboard/requests";
  }
  if (type.startsWith("ESTIMATE") || type.includes("ESTIMATE")) {
    return "/account/dashboard/estimates";
  }
  if (type.includes("INVOICE")) return "/account/dashboard/invoices";
  if (type.includes("ORDER") || type.includes("BOOKING") || type.includes("WORK_")) {
    return "/account/dashboard/orders";
  }
  return "/account/dashboard";
}
