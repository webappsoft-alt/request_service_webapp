import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type { ChatThread } from "@/lib/booking/chat-store";
import { listPublicChatThreads } from "@/lib/api/chat-client";
import {
  fetchNotifications,
  isChangeOrderNotification,
  isEstimateNotification,
  isInvoiceNotification,
  isOrderNotification,
  isPaymentNotification,
  type AppNotification,
} from "@/lib/api/notifications-client";

/**
 * Customer header + sidebar inbox: notifications, per-tab badges, and chat
 * threads. Loaded once per session, then kept live from the socket — never
 * refetched on navigation.
 */
export type CustomerBadgeKind =
  | "estimates"
  | "changeOrders"
  | "invoices"
  | "payments"
  | "orders";

const BADGE_KINDS: CustomerBadgeKind[] = [
  "estimates",
  "changeOrders",
  "invoices",
  "payments",
  "orders",
];

const NOTIFICATION_LIMIT = 30;
const CHAT_PAGE_LIMIT = 10;

/** Which sidebar tab a notification belongs to (null = header only). */
export function notificationBadgeKind(
  item: AppNotification,
): CustomerBadgeKind | null {
  if (isChangeOrderNotification(item)) return "changeOrders";
  if (isEstimateNotification(item)) return "estimates";
  if (isPaymentNotification(item)) return "payments";
  if (isInvoiceNotification(item)) return "invoices";
  if (isOrderNotification(item) || /SERVICE_SCHEDULED/i.test(item.type)) {
    return "orders";
  }
  return null;
}

type LoadStatus = "idle" | "loading" | "loaded";

type CustomerInboxState = {
  notifications: AppNotification[];
  notificationsStatus: LoadStatus;
  unreadNotifications: number;
  /**
   * Unique notification ids behind each sidebar badge. Counting ids (not
   * events) means a NEW_NOTIFICATION plus its domain event never double-count.
   */
  badgeIds: Record<CustomerBadgeKind, string[]>;
  chatThreads: ChatThread[];
  chatStatus: LoadStatus;
  chatListPage: number;
  chatListHasMore: boolean;
  /** Messages page applies its own socket updates while mounted. */
  chatViewMounted: boolean;
};

const emptyBadges = (): Record<CustomerBadgeKind, string[]> => ({
  estimates: [],
  changeOrders: [],
  invoices: [],
  payments: [],
  orders: [],
});

const initialState: CustomerInboxState = {
  notifications: [],
  notificationsStatus: "idle",
  unreadNotifications: 0,
  badgeIds: emptyBadges(),
  chatThreads: [],
  chatStatus: "idle",
  chatListPage: 1,
  chatListHasMore: false,
  chatViewMounted: false,
};

export const loadCustomerNotifications = createAsyncThunk(
  "customerInbox/loadNotifications",
  // `force` only for socket re-sync (reconnect / invalidate) — never navigation.
  async (_arg: { force?: boolean } | undefined) =>
    fetchNotifications({
      page: 1,
      limit: NOTIFICATION_LIMIT,
      status: "all",
      silent: true,
      force: true,
    }),
  {
    condition: (arg, { getState }) => {
      const status = (getState() as RootState).customerInbox?.notificationsStatus;
      if (status === "loading") return false;
      return arg?.force ? true : status === "idle";
    },
  },
);

export const loadCustomerChatThreads = createAsyncThunk(
  "customerInbox/loadChatThreads",
  async ({ email }: { email: string; force?: boolean }) => {
    const result = await listPublicChatThreads(email, {
      silent: true,
      page: 1,
      limit: CHAT_PAGE_LIMIT,
    });
    return {
      items: result.items,
      hasMore: 1 < (result.pagination?.pages || 1),
    };
  },
  {
    condition: ({ email, force }, { getState }) => {
      if (!String(email || "").trim()) return false;
      const status = (getState() as RootState).customerInbox?.chatStatus;
      if (status === "loading") return false;
      return force ? true : status === "idle";
    },
  },
);

function messageIdOf(message: unknown) {
  const row = message as { id?: string; _id?: string } | null;
  return String(row?.id || row?._id || "");
}

function upsertThreadInto(threads: ChatThread[], updated: ChatThread) {
  const index = threads.findIndex((t) => t.id === updated.id);
  if (index < 0) return [updated, ...threads];
  const existing = threads[index];
  const known = new Set(existing.messages.map(messageIdOf).filter(Boolean));
  const fresh = (updated.messages || []).filter(
    (m) => !known.has(messageIdOf(m)),
  );
  const merged: ChatThread = {
    ...existing,
    ...updated,
    providerName: updated.providerName || existing.providerName,
    providerAvatar: updated.providerAvatar || existing.providerAvatar,
    providerPhone: updated.providerPhone || existing.providerPhone,
    providerSlug: updated.providerSlug || existing.providerSlug,
    messages: [...existing.messages, ...fresh],
  };
  const next = threads.filter((t) => t.id !== updated.id);
  return [merged, ...next];
}

const customerInboxSlice = createSlice({
  name: "customerInbox",
  initialState,
  reducers: {
    notificationReceived(
      state,
      action: PayloadAction<{ notification: AppNotification; suppressBadge?: boolean }>,
    ) {
      const { notification, suppressBadge } = action.payload;
      if (state.notifications.some((row) => row.id === notification.id)) return;
      state.notifications = [notification, ...state.notifications].slice(0, 50);
      if (notification.isRead) return;
      state.unreadNotifications += 1;
      const kind = notificationBadgeKind(notification);
      if (kind && !suppressBadge && !state.badgeIds[kind].includes(notification.id)) {
        state.badgeIds[kind].push(notification.id);
      }
    },
    notificationsMarkedRead(state, action: PayloadAction<string[]>) {
      const ids = new Set(action.payload);
      let cleared = 0;
      const now = new Date().toISOString();
      state.notifications = state.notifications.map((row) => {
        if (!ids.has(row.id) || row.isRead) return row;
        cleared += 1;
        return { ...row, isRead: true, readAt: now };
      });
      state.unreadNotifications = Math.max(0, state.unreadNotifications - cleared);
    },
    setUnreadNotifications(state, action: PayloadAction<number>) {
      state.unreadNotifications = Math.max(0, action.payload);
    },
    /** Header "Mark all as read" — sidebar badges stay until their tab opens. */
    allNotificationsMarkedRead(state) {
      const now = new Date().toISOString();
      state.notifications = state.notifications.map((row) =>
        row.isRead ? row : { ...row, isRead: true, readAt: now },
      );
      state.unreadNotifications = 0;
    },
    clearBadge(state, action: PayloadAction<CustomerBadgeKind>) {
      state.badgeIds[action.payload] = [];
    },
    setChatThreads(
      state,
      action: PayloadAction<{ threads: ChatThread[]; page?: number; hasMore?: boolean }>,
    ) {
      state.chatThreads = action.payload.threads;
      if (action.payload.page != null) state.chatListPage = action.payload.page;
      if (action.payload.hasMore != null) state.chatListHasMore = action.payload.hasMore;
      state.chatStatus = "loaded";
    },
    setChatViewMounted(state, action: PayloadAction<boolean>) {
      state.chatViewMounted = action.payload;
    },
    chatThreadUpserted(state, action: PayloadAction<ChatThread>) {
      if (!action.payload?.id) return;
      state.chatThreads = upsertThreadInto(state.chatThreads, action.payload);
    },
    chatMessageReceived(
      state,
      action: PayloadAction<{ threadId: string; message: Record<string, unknown> }>,
    ) {
      const { threadId, message } = action.payload;
      const index = state.chatThreads.findIndex((t) => t.id === threadId);
      if (index < 0) return;
      const thread = state.chatThreads[index];
      const msgId = messageIdOf(message);
      if (msgId && thread.messages.some((m) => messageIdOf(m) === msgId)) return;
      const at = String(message.at || message.createdAt || new Date().toISOString());
      const updated: ChatThread = {
        ...thread,
        messages: [
          ...thread.messages,
          { ...message, id: msgId || `msg_${at}`, at } as unknown as ChatThread["messages"][number],
        ],
        updatedAt: at,
        unreadForCustomer:
          message.from === "provider"
            ? (thread.unreadForCustomer || 0) + 1
            : thread.unreadForCustomer,
      };
      state.chatThreads = [
        updated,
        ...state.chatThreads.filter((t) => t.id !== threadId),
      ];
    },
    chatReadReceipt(
      state,
      action: PayloadAction<{
        threadId: string;
        readBy?: string;
        unreadForCustomer?: number;
        unreadForProvider?: number;
      }>,
    ) {
      const { threadId, readBy, unreadForCustomer, unreadForProvider } = action.payload;
      state.chatThreads = state.chatThreads.map((t) =>
        t.id !== threadId
          ? t
          : {
              ...t,
              unreadForCustomer:
                readBy === "customer" ? (unreadForCustomer ?? 0) : t.unreadForCustomer,
              unreadForProvider:
                readBy === "provider" ? (unreadForProvider ?? 0) : t.unreadForProvider,
            },
      );
    },
    resetCustomerInbox() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCustomerNotifications.pending, (state) => {
        state.notificationsStatus = "loading";
      })
      .addCase(loadCustomerNotifications.fulfilled, (state, action) => {
        state.notificationsStatus = "loaded";
        // Keep anything the socket delivered while the first page was loading.
        const seen = new Set(state.notifications.map((row) => row.id));
        const merged = [
          ...state.notifications,
          ...action.payload.items.filter((row) => !seen.has(row.id)),
        ];
        state.notifications = merged.slice(0, 50);
        state.unreadNotifications = Math.max(
          action.payload.unreadCount,
          state.unreadNotifications,
        );
        for (const row of action.payload.items) {
          if (row.isRead) continue;
          const kind = notificationBadgeKind(row);
          if (kind && !state.badgeIds[kind].includes(row.id)) {
            state.badgeIds[kind].push(row.id);
          }
        }
      })
      .addCase(loadCustomerNotifications.rejected, (state) => {
        // Allow a later retry (e.g. after reconnect).
        state.notificationsStatus = "idle";
      })
      .addCase(loadCustomerChatThreads.pending, (state) => {
        state.chatStatus = "loading";
      })
      .addCase(loadCustomerChatThreads.fulfilled, (state, action) => {
        let threads = state.chatThreads;
        for (const thread of action.payload.items) {
          threads = upsertThreadInto(threads, thread);
        }
        state.chatThreads = threads;
        state.chatListPage = 1;
        state.chatListHasMore = action.payload.hasMore;
        state.chatStatus = "loaded";
      })
      .addCase(loadCustomerChatThreads.rejected, (state) => {
        state.chatStatus = state.chatThreads.length ? "loaded" : "idle";
      });
  },
});

export const {
  notificationReceived,
  notificationsMarkedRead,
  setUnreadNotifications,
  allNotificationsMarkedRead,
  clearBadge,
  setChatThreads,
  setChatViewMounted,
  chatThreadUpserted,
  chatMessageReceived,
  chatReadReceipt,
  resetCustomerInbox,
} = customerInboxSlice.actions;

export const selectCustomerNotifications = (state: RootState) =>
  state.customerInbox?.notifications ?? [];
export const selectCustomerUnreadNotifications = (state: RootState) =>
  state.customerInbox?.unreadNotifications ?? 0;
export const selectCustomerBadgeIds = (state: RootState) =>
  state.customerInbox?.badgeIds ?? emptyBadges();
export const selectCustomerChatThreads = (state: RootState) =>
  state.customerInbox?.chatThreads ?? [];
export const selectCustomerChatStatus = (state: RootState) =>
  state.customerInbox?.chatStatus ?? "idle";
export const selectCustomerChatListPage = (state: RootState) =>
  state.customerInbox?.chatListPage ?? 1;
export const selectCustomerChatListHasMore = (state: RootState) =>
  state.customerInbox?.chatListHasMore ?? false;
export const selectCustomerChatViewMounted = (state: RootState) =>
  Boolean(state.customerInbox?.chatViewMounted);
/** Sidebar Messages badge = unread across cached conversations. */
export const selectCustomerUnreadMessages = (state: RootState) =>
  (state.customerInbox?.chatThreads ?? []).reduce(
    (sum, thread) => sum + (thread.unreadForCustomer || 0),
    0,
  );

export { BADGE_KINDS as CUSTOMER_BADGE_KINDS };

export default customerInboxSlice.reducer;
